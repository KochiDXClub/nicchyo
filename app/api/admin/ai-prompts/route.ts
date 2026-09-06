/**
 * AIプロンプトの編集API（管理者のみ）
 *
 * ai_prompts は anon / authenticated から権限を剥がしてあるので、
 * 読み書きはすべてこのルートを通して service role で行う。
 * 認可は lib/auth/requireAdminApi.ts に寄せている。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import {
  AI_PROMPT_KEYS,
  DEFAULT_AI_PROMPTS,
  isAiPromptKey,
  normalizeAiPrompts,
  validateAiPromptBody,
  type AiPromptKey,
} from "@/lib/grandma/prompts/promptKeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 変更理由メモの上限。DB側の制約（200）と揃える */
const NOTE_MAX_LENGTH = 200;

export async function GET() {
  try {
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;

    const { data, error } = await auth.adminClient
      .from("ai_prompts")
      .select("key, body, version, note, created_at")
      .eq("is_active", true)
      .in("key", AI_PROMPT_KEYS as string[]);

    if (error) {
      return NextResponse.json({ error: "Failed to load prompts" }, { status: 500 });
    }

    // 保存済みの行が無いキーはコード側の既定値が使われている
    const activeByKey: Record<string, { version: number; note: string | null; createdAt: string }> =
      {};
    for (const row of data ?? []) {
      if (!isAiPromptKey(row.key)) continue;
      activeByKey[row.key] = {
        version: row.version,
        note: row.note,
        createdAt: row.created_at,
      };
    }

    return NextResponse.json({
      prompts: normalizeAiPrompts(data),
      defaults: DEFAULT_AI_PROMPTS,
      active: activeByKey,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load prompts" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-ai-prompts-put",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;

    const body = (await request.json().catch(() => null)) as {
      prompts?: unknown;
      note?: unknown;
    } | null;

    if (!body || !body.prompts || typeof body.prompts !== "object") {
      return NextResponse.json({ error: "Bad Request" }, { status: 400 });
    }

    // DB 制約は char_length（コードポイント単位）なので、UTF-16 単位の slice だと
    // 絵文字などのサロゲートペアが割れて Postgres の insert が落ちる
    const note =
      typeof body.note === "string" && body.note.trim()
        ? Array.from(body.note.trim()).slice(0, NOTE_MAX_LENGTH).join("")
        : null;

    // 読み取り側（normalizeAiPrompts）と同じ判定を使う。
    // ここで別の基準にすると「保存しました」と出したのにAIは既定値のまま、になる
    const accepted: { key: AiPromptKey; value: string }[] = [];
    const rejected: { key: string; reason: string }[] = [];

    for (const [key, value] of Object.entries(body.prompts as Record<string, unknown>)) {
      const result = validateAiPromptBody(key, value);
      if (result.ok) {
        accepted.push({ key: result.key, value: result.value });
      } else {
        rejected.push({ key, reason: result.reason });
      }
    }

    // 1件でも弾かれたら何も保存しない。
    // 一部だけ通ると、運営から見て「どれが保存されたか」が分からなくなる
    if (rejected.length > 0) {
      return NextResponse.json({ error: "Validation failed", rejected }, { status: 400 });
    }
    if (accepted.length === 0) {
      return NextResponse.json({ error: "No prompts to save" }, { status: 400 });
    }

    // 現在の値と同じものは新しい版を作らない。履歴が無意味に増えるのを防ぐ
    const { data: currentRows, error: readError } = await auth.adminClient
      .from("ai_prompts")
      .select("key, body")
      .eq("is_active", true)
      .in(
        "key",
        accepted.map((item) => item.key)
      );

    if (readError) {
      return NextResponse.json({ error: "Failed to save prompts" }, { status: 500 });
    }

    // 比較は正規化前の生の値で行う。normalizeAiPrompts を通すと、
    // 検証を通らないアクティブ行（あとから maxLength を下げた場合など）が
    // 既定値に見える。その状態で運営が既定値を送ると「変更なし」と判定され、
    // 不正な行がDBに残り続けて、上限を戻したときに無言で復活する
    const currentBodyByKey = new Map<string, string>(
      (currentRows ?? []).map((row) => [row.key, row.body])
    );
    const changed = accepted.filter((item) => currentBodyByKey.get(item.key) !== item.value);

    if (changed.length === 0) {
      return NextResponse.json({ ok: true, saved: [], unchanged: true });
    }

    // version の採番と旧アクティブ行の切り替えはトリガがやるので insert だけ。
    // updated_by は必ず検証済みセッションの ID を入れる（クライアントの申告は使わない）
    const { error: insertError } = await auth.adminClient.from("ai_prompts").insert(
      changed.map((item) => ({
        key: item.key,
        body: item.value,
        note,
        updated_by: auth.user.id,
      }))
    );

    if (insertError) {
      return NextResponse.json({ error: "Failed to save prompts" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, saved: changed.map((item) => item.key) });
  } catch {
    return NextResponse.json({ error: "Failed to save prompts" }, { status: 500 });
  }
}
