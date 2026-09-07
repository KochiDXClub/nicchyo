/**
 * 相談の会話設定の編集API（管理者のみ）
 *
 * ai_conversation_settings は anon / authenticated から権限を剥がしてあるので、
 * 読み書きはすべてこのルートを通して service role で行う。
 * 認可は lib/auth/requireAdminApi.ts に寄せている。
 *
 * 行の追加はできない（update のみ）。行を足しても値を読むのはコード側なので、
 * どこからも参照されない行が増えるだけになる。設定の追加はマイグレーションと
 * コードの対応が要る。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import {
  AI_CONVERSATION_SETTING_DEFS,
  AI_CONVERSATION_SETTING_KEYS,
  DEFAULT_AI_CONVERSATION_SETTINGS,
  isAiConversationSettingKey,
  normalizeAiConversationSettings,
  validateAiConversationSettingValue,
  type AiConversationSettingKey,
} from "@/lib/ai/conversationSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 1回のPUTで受け付けるキー数の上限。定義済みのキーしか無いので、その数で足りる */
const MAX_KEYS_PER_REQUEST = AI_CONVERSATION_SETTING_KEYS.length;

export async function GET() {
  try {
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;

    const { data, error } = await auth.adminClient
      .from("ai_conversation_settings")
      .select("key, label, description, value, min_value, max_value, sort_order, updated_at")
      .in("key", AI_CONVERSATION_SETTING_KEYS as string[]);

    if (error) {
      return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
    }

    // 行が無いキーはコード側の既定値が使われている。
    // 画面には「DBに無い」ことが分かるよう、範囲と説明はコード側の定義から出す
    const rowByKey = new Map(
      (data ?? []).filter((row) => isAiConversationSettingKey(row.key)).map((row) => [row.key, row])
    );

    const settings = normalizeAiConversationSettings(data);

    return NextResponse.json({
      settings,
      defaults: DEFAULT_AI_CONVERSATION_SETTINGS,
      items: AI_CONVERSATION_SETTING_DEFS.map((def) => {
        const row = rowByKey.get(def.key);
        return {
          key: def.key,
          // 見出し・説明・範囲はマイグレーションが正本。行があればそちらを出す
          label: row?.label ?? def.label,
          description: row?.description ?? def.description,
          minValue: row?.min_value ?? def.minValue,
          maxValue: row?.max_value ?? def.maxValue,
          defaultValue: def.defaultValue,
          value: settings[def.key],
          sortOrder: row?.sort_order ?? 0,
          savedInDb: !!row,
          updatedAt: row?.updated_at ?? null,
        };
      }),
    });
  } catch {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-ai-conversation-settings-put",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;

    const body = (await request.json().catch(() => null)) as { settings?: unknown } | null;

    if (!body || !body.settings || typeof body.settings !== "object") {
      return NextResponse.json({ error: "Bad Request" }, { status: 400 });
    }

    const entries = Object.entries(body.settings as Record<string, unknown>);
    if (entries.length === 0 || entries.length > MAX_KEYS_PER_REQUEST) {
      return NextResponse.json({ error: "Bad Request" }, { status: 400 });
    }

    // 読み取り側（normalizeAiConversationSettings）と同じ判定を使う。
    // ここで別の基準にすると「保存しました」と出したのにAIは既定値のまま、になる
    const accepted: { key: AiConversationSettingKey; value: number }[] = [];
    const rejected: { key: string; reason: string }[] = [];

    for (const [key, value] of entries) {
      const result = validateAiConversationSettingValue(key, value);
      if (result.ok) {
        accepted.push({ key: result.key, value: result.value });
      } else {
        // 知らないキーは中身が何であれ応答に載せる理由がない
        rejected.push({
          key: isAiConversationSettingKey(key) ? key : "(unknown)",
          reason: result.reason,
        });
      }
    }

    // 1件でも弾かれたら何も保存しない。
    // 一部だけ通ると、運営から見て「どれが保存されたか」が分からなくなる
    if (rejected.length > 0) {
      return NextResponse.json({ error: "Validation failed", rejected }, { status: 400 });
    }

    const { data: currentRows, error: readError } = await auth.adminClient
      .from("ai_conversation_settings")
      .select("key, value")
      .in(
        "key",
        accepted.map((item) => item.key)
      );

    if (readError) {
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }

    const currentValueByKey = new Map<string, number>(
      (currentRows ?? []).map((row) => [row.key, row.value])
    );

    // 値が同じものは書かない。監査ログと「最終更新」が無意味に動くのを防ぐ
    const changed = accepted.filter((item) => currentValueByKey.get(item.key) !== item.value);
    if (changed.length === 0) {
      return NextResponse.json({ ok: true, saved: [], unchanged: true });
    }

    for (const item of changed) {
      // insert は型でも DB 権限でも塞いである。行が無いキーは、
      // マイグレーションが未適用ということなので 0 件更新として弾く
      const { data: updated, error: updateError } = await auth.adminClient
        .from("ai_conversation_settings")
        .update({ value: item.value, updated_by: auth.user.id })
        .eq("key", item.key)
        .select("key");

      if (updateError) {
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
      }
      if (!updated || updated.length === 0) {
        // 成功を返すと「保存したのに効かない」状態に気づけない
        return NextResponse.json(
          { error: "Setting not found", key: item.key },
          { status: 404 }
        );
      }
    }

    const { error: auditError } = await auth.adminClient.from("admin_audit_logs").insert(
      changed.map((item) => ({
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        actor_role: auth.role,
        action: "ai_conversation_setting_updated",
        target_type: "ai_conversation_settings",
        target_id: item.key,
        details: JSON.stringify({ value: item.value }),
      }))
    );
    // 監査ログが書けなくても保存は成立している。理由が消えないよう記録だけ残す
    if (auditError) console.error("[ai-conversation-settings] audit log failed", auditError);

    return NextResponse.json({ ok: true, saved: changed.map((item) => item.key) });
  } catch {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
