/**
 * AIプロンプトの履歴とロールバック（管理者のみ）
 *
 * プロンプトは壊れやすく、壊れたときに「昨日の状態に戻す」が最速の復旧手段になる。
 * そのために ai_prompts は上書きではなく version を積む形にしてある。
 *
 * GET  ?key=...  … そのキーの版を新しい順に返す
 * POST { key, version } … その版の本文を新しい版として作り直し、アクティブにする
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { isAiPromptKey, validateAiPromptBody } from "@/lib/grandma/prompts/promptKeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 1キーあたりに返す版の上限。古い版まで全部返しても運営は使わない */
const HISTORY_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    // 全バージョンの本文を返す、本ルートで最も情報量の多い読み取り口なので、
    // app/api/admin/spots/route.ts に揃えて GET にも同一オリジン検査を掛ける
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;

    const key = request.nextUrl.searchParams.get("key");
    if (!isAiPromptKey(key)) {
      return NextResponse.json({ error: "Unknown key" }, { status: 400 });
    }

    const { data, error } = await auth.adminClient
      .from("ai_prompts")
      .select("id, key, body, version, is_active, note, created_at")
      .eq("key", key)
      .order("version", { ascending: false })
      .limit(HISTORY_LIMIT);

    if (error) {
      return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
    }

    return NextResponse.json({ key, versions: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-ai-prompts-rollback",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;

    const body = (await request.json().catch(() => null)) as {
      key?: unknown;
      version?: unknown;
    } | null;

    if (!isAiPromptKey(body?.key)) {
      return NextResponse.json({ error: "Unknown key" }, { status: 400 });
    }
    const version = body?.version;
    if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
      return NextResponse.json({ error: "Bad Request" }, { status: 400 });
    }

    const { data: target, error: readError } = await auth.adminClient
      .from("ai_prompts")
      .select("body, is_active")
      .eq("key", body.key)
      .eq("version", version)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: "Failed to roll back" }, { status: 500 });
    }
    if (!target) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    if (target.is_active) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    // 戻す先が今の上限を超えている場合がある（上限を下げた後など）。
    // そのまま復活させると読み取り側が既定値に落ちて「戻したのに変わらない」になるので、
    // 保存と同じ判定をここでも通す
    const validated = validateAiPromptBody(body.key, target.body);
    if (!validated.ok) {
      return NextResponse.json(
        { error: "Version cannot be restored", reason: validated.reason },
        { status: 400 }
      );
    }

    // 過去の行の is_active を直接立てるのではなく、同じ本文で新しい版を作る。
    // 履歴が「いつ何が使われていたか」の記録として一直線に残る。
    // version の採番と旧アクティブ行の切り替えはトリガがやる
    const { error: insertError } = await auth.adminClient.from("ai_prompts").insert({
      key: validated.key,
      body: validated.value,
      note: `v${version} に戻した`,
      updated_by: auth.user.id,
    });

    if (insertError) {
      return NextResponse.json({ error: "Failed to roll back" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, restoredFrom: version });
  } catch {
    return NextResponse.json({ error: "Failed to roll back" }, { status: 500 });
  }
}
