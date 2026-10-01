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
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/adminClient";
import {
  embedQuestion,
  formatNotesForPrompt,
  formatPopularForPrompt,
  loadPopularForVisitors,
  searchStoreNotes,
} from "@/lib/vendor/aiNotes.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; text: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * このお店のノート（届け先がお客さん）と、本人が許したときの「よく売れている商品」を、
 * プロンプトに足す形で返す。読めなければ空文字（ノート無しで答える）。
 */
async function loadShopNotesForVisitors(apiKey: string, vendorId: string, question: string): Promise<string> {
  const admin = createAdminClient() as unknown as SupabaseClient | null;
  if (!admin) return "";
  // 実在するお店の ID のときだけ読む（でたらめな ID で探させない）
  const { data: vendor } = await admin.from("vendors").select("id").eq("id", vendorId).maybeSingle();
  if (!vendor) return "";
  const embedding = await embedQuestion(apiKey, question);
  const [notes, popular] = await Promise.all([
    embedding ? searchStoreNotes(admin, embedding, vendorId, "visitor").catch(() => []) : Promise.resolve([]),
    loadPopularForVisitors(admin, vendorId).catch(() => []),
  ]);
  return [formatNotesForPrompt(notes), formatPopularForPrompt(popular)].filter(Boolean).join("\n\n");
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

  let body: {
    shopName: string;
    shopContext: ShopChatContext;
    history: ChatMessage[];
    text: string;
    /** お店の出店者 ID。あれば、そのお店のノート（届け先がお客さん）を探して答えに使う */
    vendorId?: unknown;
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

  const vendorId = typeof body.vendorId === "string" && UUID_PATTERN.test(body.vendorId) ? body.vendorId : null;
  const shopNotes = vendorId ? await loadShopNotesForVisitors(apiKey, vendorId, text) : "";
  const systemPrompt = [buildShopChatSystemPrompt(shopName, shopContext ?? {}), shopNotes]
    .filter(Boolean)
    .join("\n\n");
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
