import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { handleAbuseDetection } from "@/lib/grandma/abuseDetection";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import {
  buildShopChatSystemPrompt,
  type ShopChatContext,
} from "@/lib/grandma/prompts/shopChatPrompt";
import { requestChatCompletion } from "@/lib/ai/openaiFetch";
import { openAiSseToTextStream, TEXT_STREAM_HEADERS } from "@/lib/ai/textStream";
import { resolveAiModelFor } from "@/lib/ai/modelStore.server";
import { getForwardedClientIp } from "@/lib/security/clientIp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 直近何往復ぶんの履歴をプロンプトに含めるか。AiConsultPanel も同じ件数に切って送る */
const SHOP_CHAT_HISTORY_LIMIT = 10;

// system prompt に埋め込まれる値なので、長さと形式をここで縛る
// （縛らないと、クライアントが任意の system prompt と無制限の入力を送れてしまう）
const ShopChatBodySchema = z.object({
  shopName: z.string().trim().min(1).max(100),
  shopContext: z
    .object({
      category: z.string().max(100).nullish(),
      catchphrase: z.string().max(300).nullish(),
      shopStrength: z.string().max(1000).nullish(),
      products: z.array(z.string().max(100)).max(30).nullish(),
      chome: z.string().max(50).nullish(),
    })
    .nullish(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
    .max(SHOP_CHAT_HISTORY_LIMIT)
    .optional(),
  text: z.string().trim().min(1).max(500),
  visitorKey: z.string().max(128).nullish(),
});

/** プロンプトの区切りに使われる括弧と改行を落とす（システムプロンプトへの偽ブロック混入防止） */
function sanitizePromptField(value: string): string {
  return value.replace(/[<>[\]【】\r\n]+/g, " ").trim();
}

function sanitizeShopContext(
  ctx: z.infer<typeof ShopChatBodySchema>["shopContext"]
): ShopChatContext {
  if (!ctx) return {};
  const clean = (v?: string | null) => (v ? sanitizePromptField(v) : undefined);
  return {
    category: clean(ctx.category),
    catchphrase: clean(ctx.catchphrase),
    shopStrength: clean(ctx.shopStrength),
    products: ctx.products?.map(sanitizePromptField).filter(Boolean),
    chome: clean(ctx.chome),
  };
}

export async function POST(req: NextRequest) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "grandma-shop-chat",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response("Server configuration error", { status: 500 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const parsed = ShopChatBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return new Response("Bad Request", { status: 400 });
  }
  const { shopContext, history = [], text } = parsed.data;
  const shopName = sanitizePromptField(parsed.data.shopName);
  if (!shopName) {
    return new Response("Bad Request", { status: 400 });
  }

  // ask / itinerary と同じ悪用ブロック（IP / visitorKey）を通す。
  // これが無いと、ask でブロック済みの利用者が shop-chat 経由で有料 LLM 呼び出しを続けられる
  const secClient = createAdminClient();
  if (secClient) {
    const clientIp = getForwardedClientIp(req);
    const abuseResult = await handleAbuseDetection(
      secClient,
      clientIp,
      text,
      parsed.data.visitorKey?.trim() || undefined
    );
    if (abuseResult === "blocked") {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const systemPrompt = buildShopChatSystemPrompt(shopName, sanitizeShopContext(shopContext));
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.text })),
    { role: "user", content: text },
  ];

  const aiModel = await resolveAiModelFor("shopChat");

  const upstream = await requestChatCompletion(apiKey, aiModel, {
    messages,
    maxOutputTokens: 280,
    temperature: 0.7,
    stream: true,
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Upstream error", { status: 502 });
  }

  const readable = openAiSseToTextStream(upstream.body);

  return new Response(readable, {
    headers: {
      ...TEXT_STREAM_HEADERS,
      "Transfer-Encoding": "chunked",
      // この回答を識別する ID。評価（/api/grandma/feedback）と突き合わせるために返す。
      // 本文はそのまま画面に出す文字列なので、ID はヘッダーで渡す
      "X-Consult-Id": crypto.randomUUID(),
      "Access-Control-Expose-Headers": "X-Consult-Id",
    },
  });
}
