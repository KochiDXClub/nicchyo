import { NextRequest } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { buildShopChatSystemPrompt } from "@/lib/grandma/prompts/shopChatPrompt";
import { fetchAiPrompts } from "@/lib/grandma/prompts/promptStore.server";
import { resolveShopCharacter, resolveShopCharacterId } from "@/lib/grandma/shopChat/character";
import { loadShopChat } from "@/lib/grandma/shopChat/context.server";
import { ShopChatRequestSchema, trimShopChatHistory } from "@/lib/grandma/shopChat/request";
import { requestChatCompletion } from "@/lib/ai/openaiFetch";
import { openAiSseToTextStream, TEXT_STREAM_HEADERS } from "@/lib/ai/textStream";
import { resolveAiModelFor } from "@/lib/ai/modelStore.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const parsed = ShopChatRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response("Bad Request", { status: 400 });
  }
  const { shopId, text, history } = parsed.data;

  // お店の情報・メモ・キャラは、利用者から受け取らずサーバーが読む
  const loaded = await loadShopChat(shopId);
  if (!loaded) {
    return new Response("Shop not found", { status: 404 });
  }

  const prompts = await fetchAiPrompts();
  const character = resolveShopCharacter(resolveShopCharacterId(loaded.shop.vendorId), prompts);

  const systemPrompt = buildShopChatSystemPrompt({
    character: { name: character.view.name, profile: character.profile },
    shopName: loaded.shop.name,
    shopContext: loaded.context,
    notes: loaded.notes,
  });
  const messages = [
    { role: "system", content: systemPrompt },
    ...trimShopChatHistory(history).map((m) => ({ role: m.role, content: m.text })),
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
