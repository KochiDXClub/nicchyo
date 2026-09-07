/**
 * AIモデル台帳と、機能ごとの割り当てAPI（管理者のみ）
 *
 * ai_models / ai_use_cases は anon / authenticated から権限を剥がしてあるので、
 * 読み書きはすべてこのルートを通して service role で行う。
 * 認可は lib/auth/requireAdminApi.ts に寄せている
 * （app/api/admin/ai-prompts/route.ts と同じ形）。
 *
 * 更新できるのは ai_use_cases の model_id / reasoning_effort だけ。
 * 機能そのものとモデル台帳の追加はマイグレーションで行う。
 * 機能の行を足してもコード側に呼び出しが無ければ何も起きないし、
 * モデルは能力の列を間違えると本番のリクエストが落ちるため。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import {
  AI_USE_CASES,
  DEFAULT_AI_MODEL_SETTINGS,
  buildAiCatalog,
  findAiModel,
  isAiUseCase,
  normalizeAiModelSettings,
  validateAiModelChoice,
  type AiModelChoice,
  type AiUseCase,
} from "@/lib/ai/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODELS_TABLE = "ai_models";
const USE_CASES_TABLE = "ai_use_cases";

const MODEL_COLUMNS =
  "id, label, description, token_param, supports_temperature, reasoning_efforts, reasoning_headroom_tokens, price_input_per_mtok, price_output_per_mtok, is_selectable, sort_order";
const USE_CASE_COLUMNS =
  "key, label, description, model_id, reasoning_effort, is_enabled, sort_order, updated_at";

export async function GET() {
  try {
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;

    const [modelsResult, useCasesResult] = await Promise.all([
      auth.adminClient
        .from(MODELS_TABLE)
        .select(MODEL_COLUMNS)
        .eq("is_selectable", true)
        .order("sort_order", { ascending: true }),
      auth.adminClient
        .from(USE_CASES_TABLE)
        .select(USE_CASE_COLUMNS)
        .eq("is_enabled", true)
        .in("key", AI_USE_CASES as string[])
        .order("sort_order", { ascending: true }),
    ]);

    if (modelsResult.error || useCasesResult.error) {
      return NextResponse.json({ error: "Failed to load AI registry" }, { status: 500 });
    }

    const catalog = buildAiCatalog(modelsResult.data, useCasesResult.data);

    // モデル未設定（model_id が null）の機能はコード側の既定値が使われている。
    // 画面で「既定のまま」を出し分けるために、設定済みの機能だけを別に返す
    const savedAt: Record<string, string> = {};
    // 保存されているモデルが台帳から消えた・選べなくなった機能。
    // 読み取り側は黙って既定値に戻すので、運営に伝えないと
    // 「設定したはずなのに違うモデルで動いている」ことに気づけない
    const fellBack: string[] = [];

    for (const row of useCasesResult.data ?? []) {
      // .in() で絞ってはいるが、ここでも見る。クエリを変えたときに
      // 黙って穴が開かないようにするため（ai-prompts の GET と同じ形）
      if (!isAiUseCase(row.key)) continue;
      if (!row.model_id) continue;
      savedAt[row.key] = row.updated_at;
      if (!findAiModel(catalog, row.model_id)) fellBack.push(row.key);
    }

    return NextResponse.json({
      models: catalog.models,
      useCases: catalog.useCases,
      settings: normalizeAiModelSettings(catalog, useCasesResult.data),
      defaults: DEFAULT_AI_MODEL_SETTINGS,
      savedAt,
      fellBack,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load AI registry" }, { status: 500 });
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

    const entries = Object.entries(body.settings as Record<string, unknown>);
    // 機能の数は決まっている。それを超えるボディは正当な呼び出しではない
    if (entries.length > AI_USE_CASES.length) {
      return NextResponse.json({ error: "Too many settings" }, { status: 400 });
    }

    // 検証は台帳（DBの ai_models）に対して行う。コード側の定義に対して見ると、
    // マイグレーションで足したモデルが「知らないモデル」として弾かれる
    const [modelsResult, useCasesResult] = await Promise.all([
      auth.adminClient
        .from(MODELS_TABLE)
        .select(MODEL_COLUMNS)
        .eq("is_selectable", true)
        .order("sort_order", { ascending: true }),
      auth.adminClient
        .from(USE_CASES_TABLE)
        .select(USE_CASE_COLUMNS)
        .eq("is_enabled", true)
        .in("key", AI_USE_CASES as string[]),
    ]);

    if (modelsResult.error || useCasesResult.error) {
      console.error(
        "[admin/ai-models] read failed:",
        modelsResult.error?.message ?? useCasesResult.error?.message
      );
      return NextResponse.json({ error: "Failed to save AI model settings" }, { status: 500 });
    }

    const catalog = buildAiCatalog(modelsResult.data, useCasesResult.data);

    // 読み取り側（normalizeAiModelSettings）と同じ判定を使う。
    // ここで別の基準にすると「保存しました」と出したのにAIは既定のモデルのまま、になる
    const accepted: { useCase: AiUseCase; choice: AiModelChoice }[] = [];
    const rejected: { useCase: string; reason: string }[] = [];

    for (const [useCase, value] of entries) {
      const choice = (value ?? {}) as { modelId?: unknown; reasoningEffort?: unknown };
      const result = validateAiModelChoice(
        catalog,
        useCase,
        choice.modelId,
        choice.reasoningEffort
      );
      if (result.ok) {
        accepted.push({ useCase: result.useCase, choice: result.choice });
      } else {
        // 弾いたキーをそのまま返さない（受け取った文字列をレスポンスに反射させない）
        rejected.push({ useCase: useCase.slice(0, 50), reason: result.reason });
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

    // 現在の値と同じものは書かない。
    // API を直接叩けば、値を変えずに監査ログを何行でも積めてしまう。
    // 監査ログはこのテーブルの唯一の記録なので、ノイズを入れられる口は塞ぐ。
    // 画面の「最終更新」（updated_at）が実際には変えていない時刻になるのも防げる
    const currentByKey = new Map(
      (useCasesResult.data ?? []).map((row) => [
        row.key,
        { modelId: row.model_id, reasoningEffort: row.reasoning_effort },
      ])
    );
    const changed = accepted.filter((item) => {
      const current = currentByKey.get(item.useCase);
      if (!current) return true;
      return (
        current.modelId !== item.choice.modelId ||
        (current.reasoningEffort ?? null) !== (item.choice.reasoningEffort ?? null)
      );
    });

    if (changed.length === 0) {
      return NextResponse.json({ ok: true, saved: [], unchanged: true });
    }

    // 機能の行はマイグレーションで作ってあるので update だけ。
    // upsert にすると、コードに無いキーの行を API から作れてしまう。
    // updated_by は必ず検証済みセッションの ID を入れる（クライアントの申告は使わない）
    for (const item of changed) {
      const { data: updated, error: updateError } = await auth.adminClient
        .from(USE_CASES_TABLE)
        .update({
          model_id: item.choice.modelId,
          reasoning_effort: item.choice.reasoningEffort ?? null,
          updated_by: auth.user.id,
        })
        .eq("key", item.useCase)
        // 無効化した機能に「保存しました」と返さない。
        // 読み取り側は is_enabled = true で絞るので、書けても効かない
        .eq("is_enabled", true)
        .select("key");

      if (updateError) {
        // DB のトリガ（ai_use_cases_validate_model）に弾かれた場合など、
        // 理由が分からないと追跡できない
        console.error("[admin/ai-models] update failed:", updateError.message);
        return NextResponse.json({ error: "Failed to save AI model settings" }, { status: 500 });
      }
      // 0行更新は「成功したが何も効いていない」状態。成功として返さない
      if (!updated || updated.length === 0) {
        console.error("[admin/ai-models] no row updated:", item.useCase);
        return NextResponse.json({ error: "Failed to save AI model settings" }, { status: 500 });
      }
    }

    // 版を積まない代わりに、誰がいつ何に変えたかはここに残す。
    // actor_email / actor_role は管理画面の監査ログ一覧が実行者の表示・検索・
    // 集計に使う。抜けると「誰かが変えた」ことしか残らない。
    // 記録に失敗しても保存そのものは成功させる（監査ログのために設定変更を
    // 巻き戻すと、運営から見て何が起きたか分からなくなる）
    const { error: auditError } = await auth.adminClient.from("admin_audit_logs").insert(
      changed.map((item) => ({
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        actor_role: auth.role,
        action: "ai_model_updated",
        target_type: "ai_use_cases",
        target_id: item.useCase,
        details: JSON.stringify({
          modelId: item.choice.modelId,
          reasoningEffort: item.choice.reasoningEffort ?? null,
        }),
      }))
    );
    if (auditError) {
      console.error("[admin/ai-models] audit log failed:", auditError.message);
    }

    return NextResponse.json({ ok: true, saved: changed.map((item) => item.useCase) });
  } catch {
    return NextResponse.json({ error: "Failed to save AI model settings" }, { status: 500 });
  }
}
