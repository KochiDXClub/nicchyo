/**
 * 場面ごとのAIモデル設定API（管理者のみ）
 *
 * ai_model_settings は anon / authenticated から権限を剥がしてあるので、
 * 読み書きはすべてこのルートを通して service role で行う。
 * 認可は lib/auth/requireAdminApi.ts に寄せている
 * （app/api/admin/ai-prompts/route.ts と同じ形）。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import {
  AI_USE_CASES,
  DEFAULT_AI_MODEL_SETTINGS,
  normalizeAiModelSettings,
  validateAiModelChoice,
  type AiModelChoice,
  type AiUseCase,
} from "@/lib/ai/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE = "ai_model_settings";

export async function GET() {
  try {
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;

    const { data, error } = await auth.adminClient
      .from(TABLE)
      .select("use_case, model_id, reasoning_effort, updated_at")
      .in("use_case", AI_USE_CASES as string[]);

    if (error) {
      return NextResponse.json({ error: "Failed to load model settings" }, { status: 500 });
    }

    // 保存済みの行が無い場面はコード側の既定値が使われている。
    // 画面で「既定のまま」と出し分けるために、保存済みの場面だけを別に返す
    const savedAt: Record<string, string> = {};
    for (const row of data ?? []) {
      savedAt[row.use_case] = row.updated_at;
    }

    return NextResponse.json({
      settings: normalizeAiModelSettings(data),
      defaults: DEFAULT_AI_MODEL_SETTINGS,
      savedAt,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load model settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-ai-models-put",
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

    // 読み取り側（normalizeAiModelSettings）と同じ判定を使う。
    // ここで別の基準にすると「保存しました」と出したのにAIは既定のモデルのまま、になる
    const accepted: { useCase: AiUseCase; choice: AiModelChoice }[] = [];
    const rejected: { useCase: string; reason: string }[] = [];

    for (const [useCase, value] of Object.entries(body.settings as Record<string, unknown>)) {
      const choice = (value ?? {}) as { modelId?: unknown; reasoningEffort?: unknown };
      const result = validateAiModelChoice(useCase, choice.modelId, choice.reasoningEffort);
      if (result.ok) {
        accepted.push({ useCase: result.useCase, choice: result.choice });
      } else {
        rejected.push({ useCase, reason: result.reason });
      }
    }

    // 1件でも弾かれたら何も保存しない。
    // 一部だけ通ると、運営から見て「どれが保存されたか」が分からなくなる
    // （ai-prompts の PUT と同じ方針）
    if (rejected.length > 0) {
      return NextResponse.json({ error: "Validation failed", rejected }, { status: 400 });
    }
    if (accepted.length === 0) {
      return NextResponse.json({ error: "No settings to save" }, { status: 400 });
    }

    // updated_by は必ず検証済みセッションの ID を入れる（クライアントの申告は使わない）
    const { error: upsertError } = await auth.adminClient.from(TABLE).upsert(
      accepted.map((item) => ({
        use_case: item.useCase,
        model_id: item.choice.modelId,
        reasoning_effort: item.choice.reasoningEffort ?? null,
        updated_by: auth.user.id,
      })),
      { onConflict: "use_case" }
    );

    if (upsertError) {
      return NextResponse.json({ error: "Failed to save model settings" }, { status: 500 });
    }

    // ai_prompts と違って版を積まないので、誰がいつ何に変えたかはここに残す。
    // 記録に失敗しても保存そのものは成功させる（監査ログのために設定変更を
    // 巻き戻すと、運営から見て何が起きたか分からなくなる）
    const { error: auditError } = await auth.adminClient.from("admin_audit_logs").insert(
      accepted.map((item) => ({
        actor_id: auth.user.id,
        action: "update_ai_model_setting",
        target_type: "ai_model_settings",
        target_id: item.useCase,
        details: item.choice.reasoningEffort
          ? `${item.choice.modelId}（推論: ${item.choice.reasoningEffort}）`
          : item.choice.modelId,
      }))
    );
    if (auditError) {
      console.error("[admin/ai-models] audit log failed:", auditError.message);
    }

    return NextResponse.json({ ok: true, saved: accepted.map((item) => item.useCase) });
  } catch {
    return NextResponse.json({ error: "Failed to save model settings" }, { status: 500 });
  }
}
