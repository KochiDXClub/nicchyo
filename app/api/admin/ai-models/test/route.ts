/**
 * AIモデルの対話テスト（管理者のみ）
 *
 * 管理画面で「このモデルに切り替えたらどう答えるか・何秒かかるか」を、
 * 保存する前にその場で試すためのAPI。1回の呼び出しで1モデル × 1質問を投げる。
 * 複数モデル・複数質問の同時比較は、画面側がこのAPIを並列に呼んで行う。
 *
 * 本番の相談と同じ本体（handleConsultAsk）を、モデルだけ差し替えて呼ぶ。
 * 別のプロンプトで試しても「本番ではどうなるか」の答えにならないため。
 * 内部呼び出しなので相談ログは残らず、レート制限・不正検知も通らない
 * （ConsultAskInternalOptions を参照）。
 *
 * 選んだモデルが OpenAI 側で使えないときの既定モデルへのフォールバックは
 * ここでは**わざと効かせない**。フォールバックが効くと、使えないモデルが
 * 「ちゃんと答えた」ように見えてしまう。
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { fetchAiRegistry } from "@/lib/ai/modelStore.server";
import { resolveAiModelChoice, validateAiModelChoice } from "@/lib/ai/models";
import { handleConsultAsk } from "@/app/api/grandma/ask/handler";
import type { ConsultAskResponse } from "@/app/(public)/consult/types/consultConversation";
import type { AiModelTestResult } from "@/lib/ai/modelTest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  modelId: z.string().min(1).max(100),
  reasoningEffort: z.string().max(20).optional(),
  // 相談本体は4文字未満を「もう少し詳しく」で弾く。上限はプロンプトを押し流さない程度
  question: z.string().trim().min(4).max(300),
});

// 結果の型は画面と共有するため lib/ai/modelTest.ts に置く

export async function POST(request: NextRequest) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    // 1回ごとに OpenAI の費用がかかる。管理者でも無制限にはしない
    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-ai-models-test",
      limit: 60,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;

    // IP の制限は未認証の連打対策。認可後は管理者ごとにも上限を置く
    // （共有端末や乗っ取られたアカウントからの連打で費用が線形に増えるのを抑える）
    const perUserLimited = await enforceRateLimit(request, {
      bucket: "admin-ai-models-test-user",
      keySuffix: auth.user.id,
      limit: 60,
      windowMs: 10 * 60 * 1000,
    });
    if (perUserLimited) return perUserLimited;

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Bad Request" }, { status: 400 });
    }
    const { modelId, reasoningEffort, question } = parsed.data;

    // 台帳に無いモデルは通さない（保存時と同じ判定）
    const { catalog } = await fetchAiRegistry();
    const validated = validateAiModelChoice(catalog, "consult", modelId, reasoningEffort);
    if (!validated.ok) {
      return NextResponse.json({ error: "Validation failed", reason: validated.reason }, { status: 400 });
    }

    const resolved = resolveAiModelChoice(catalog, validated.choice, "consult");
    // フォールバックを外す（ファイル冒頭のコメントを参照）
    const modelOverride = { def: resolved.def, reasoningEffort: resolved.reasoningEffort };

    const origin = new URL(request.url).origin;
    const synthetic = new Request(`${origin}/api/grandma/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: question, stream: false }),
    });

    const startedAt = Date.now();
    const response = await handleConsultAsk(synthetic, { modelOverride });
    const elapsedMs = Date.now() - startedAt;

    const payload = (await response.json().catch(() => ({}))) as ConsultAskResponse;

    const result: AiModelTestResult = {
      ok: response.ok && !payload.errorCode,
      status: response.status,
      elapsedMs,
      modelId: resolved.def.id,
      reasoningEffort: resolved.reasoningEffort ?? null,
      reply: payload.reply ?? "",
      turns: (payload.turns ?? []).map((turn) => ({
        speakerName: turn.speakerName,
        text: turn.text,
      })),
      shops: (payload.shops ?? []).map((shop) => ({ id: shop.id, name: shop.name })),
      followUpQuestion: payload.followUpQuestion ?? "",
      errorCode: payload.errorCode ?? null,
      errorMessage: payload.errorMessage ?? null,
      debugError: payload.debugError ?? null,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin/ai-models/test] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to run AI model test" }, { status: 500 });
  }
}
