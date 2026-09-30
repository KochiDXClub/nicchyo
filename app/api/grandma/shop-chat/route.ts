import { NextRequest } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import {
  buildShopChatSystemPrompt,
  type ShopChatContext,
} from "@/lib/grandma/prompts/shopChatPrompt";
import { requestChatCompletion } from "@/lib/ai/openaiFetch";
import { openAiSseToTextStream, TEXT_STREAM_HEADERS } from "@/lib/ai/textStream";
import { resolveAiModelFor } from "@/lib/ai/modelStore.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; text: string };

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

  let body: {
    shopName: string;
    shopContext: ShopChatContext;
    history: ChatMessage[];
    text: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { shopName, shopContext, history, text } = body;
  if (!shopName || !text) {
    return new Response("Missing required fields", { status: 400 });
  }

  const systemPrompt = buildShopChatSystemPrompt(shopName, shopContext ?? {});
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
