import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { DatabaseWithExtensions } from "@/types/database.extensions";
import { buildGrandmaAiSystemPrompt } from "@/lib/grandma/prompts/consultSystemPrompt";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { maskPii } from "@/lib/privacy/maskPii";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import {
  CONSULT_CHARACTER_BY_ID,
  pickConsultCharacters,
  type ConsultCharacter,
  type ConsultCharacterId,
} from "@/app/(public)/consult/data/consultCharacters";
import type {
  ConsultAskResponse,
  ConsultHistoryEntry,
  ConsultTurn,
} from "@/app/(public)/consult/types/consultConversation";
import type { Shop } from "@/app/(public)/map/data/shops";
import type { KnowledgeRow, ParsedRequest } from "@/lib/grandma/types";
import {
  extractKeywords,
  isShopRelatedQuestion,
  isSeasonalQuestion,
  getCurrentSeasonInfo,
  isUnsupportedQuestion,
  buildErrorResponse,
  buildHistoryContext,
  classifyLocationType,
  classifyIntent,
  isValidFollowUpQuestion,
  buildFallbackFollowUpQuestion,
} from "@/lib/grandma/consultUtils";
import {
  summarizeShops,
  sortShopIdsByDistance,
  fetchCandidateVendorIds,
  fetchSeasonalProductContext,
  fetchShopsByVendorIds,
  fetchShopByStoreNumber,
  fetchShopByName,
} from "@/lib/grandma/vendorSearch";
import {
  buildResponseSchema,
  pickConversationPattern,
  parseStreamingConsultOutput,
  buildReplyFromTurns,
} from "@/lib/grandma/promptBuilder";
import {
  buildConversationPatternPrompt,
  buildStreamingFormatPrompt,
} from "@/lib/grandma/prompts/consultConversation";
import { handleAbuseDetection } from "@/lib/grandma/abuseDetection";
import { z } from "zod";

const ConsultHistoryEntrySchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  speakerId: z.string().nullable().optional(),
  speakerName: z.string().nullable().optional(),
});

const AskJsonBodySchema = z.object({
  text: z.string().optional(),
  location: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
  shopId: z.number().int().nullable().optional(),
  shopName: z.string().nullable().optional(),
  history: z.array(ConsultHistoryEntrySchema).optional(),
  memorySummary: z.string().optional(),
  preferredCharacterId: z.string().nullable().optional(),
  visitorKey: z.string().max(128).nullable().optional(),
  stream: z.boolean().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function parseRequest(request: Request): Promise<ParsedRequest> {
  const contentType = request.headers.get("content-type") ?? "";
  let text = "";
  let location: { lat: number; lng: number } | null = null;
  let imageDataUrl: string | null = null;
  let targetShopId: number | null = null;
  let targetShopName: string | null = null;
  let history: ConsultHistoryEntry[] = [];
  let memorySummary = "";
  let preferredCharacterId: ConsultCharacterId | null = null;
  let visitorKey: string | null = null;
  let stream = false;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    text = typeof form.get("text") === "string" ? String(form.get("text")) : "";
    if (typeof form.get("location") === "string") {
      try {
        location = JSON.parse(String(form.get("location"))) as {
          lat: number;
          lng: number;
        } | null;
      } catch {
        location = null;
      }
    }
    if (typeof form.get("shopId") === "string" && String(form.get("shopId")).trim()) {
      const parsed = Number(form.get("shopId"));
      targetShopId = Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof form.get("shopName") === "string" && String(form.get("shopName")).trim()) {
      targetShopName = String(form.get("shopName")).trim();
    }
    if (typeof form.get("history") === "string") {
      try {
        history = JSON.parse(String(form.get("history"))) as ConsultHistoryEntry[];
      } catch {
        history = [];
      }
    }
    if (typeof form.get("memorySummary") === "string") {
      memorySummary = String(form.get("memorySummary")).trim();
    }
    if (typeof form.get("preferredCharacterId") === "string") {
      const value = String(form.get("preferredCharacterId")).trim() as ConsultCharacterId;
      preferredCharacterId = CONSULT_CHARACTER_BY_ID.has(value) ? value : null;
    }
    if (typeof form.get("visitorKey") === "string") {
      const vk = String(form.get("visitorKey")).trim();
      visitorKey = vk.length > 0 && vk.length <= 128 ? vk : null;
    }
    if (typeof form.get("stream") === "string") {
      const streamValue = String(form.get("stream")).trim().toLowerCase();
      stream = streamValue === "1" || streamValue === "true";
    }
    const formImage = form.get("image");
    if (formImage && typeof formImage === "object" && "arrayBuffer" in formImage) {
      const imageFile = formImage as File;
      const arrayBuffer = await imageFile.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mime = imageFile.type || "image/jpeg";
      imageDataUrl = `data:${mime};base64,${base64}`;
    }
  } else {
    const parsed = AskJsonBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      const err = new Error(parsed.error.issues[0].message);
      (err as Error & { statusCode: number }).statusCode = 400;
      throw err;
    }
    const payload = parsed.data;
    text = payload.text ?? "";
    location = payload.location ?? null;
    targetShopId =
      typeof payload.shopId === "number" && Number.isFinite(payload.shopId)
        ? payload.shopId
        : null;
    targetShopName = payload.shopName?.trim() || null;
    history = (payload.history ?? []) as ConsultHistoryEntry[];
    memorySummary = payload.memorySummary?.trim() || "";
    const charId = payload.preferredCharacterId as ConsultCharacterId | null;
    preferredCharacterId = charId && CONSULT_CHARACTER_BY_ID.has(charId) ? charId : null;
    if (typeof payload.visitorKey === "string") {
      const vk = payload.visitorKey.trim();
      visitorKey = vk.length > 0 && vk.length <= 128 ? vk : null;
    }
    stream = payload.stream === true;
  }

  return {
    text: text.trim(),
    location,
    imageDataUrl,
    targetShopId,
    targetShopName,
    history,
    memorySummary,
    preferredCharacterId,
    visitorKey,
    stream,
  };
}

async function finalizeConsultResponse(options: {
  request: Request;
  supabase: SupabaseClient<Database>;
  consultId: string;
  text: string;
  keywords: string[];
  location: { lat: number; lng: number } | null;
  visitorKey: string | null;
  targetShopName: string | null;
  targetShop: Shop | null;
  candidateShops: Shop[];
  turns: ConsultTurn[];
  shopIds: number[];
  imageUrl: string | null;
  followUpQuestion: string;
  summary: string;
  shopIntent: boolean;
  memorySummary: string;
}): Promise<ConsultAskResponse> {
  const {
    request,
    supabase,
    consultId,
    text,
    keywords,
    location,
    visitorKey,
    targetShopName,
    targetShop,
    candidateShops,
    turns,
    shopIds,
    imageUrl,
    followUpQuestion,
    summary,
    shopIntent,
    memorySummary,
  } = options;

  const normalizedTurns = turns
    .filter((turn) => turn.text.trim().length > 0)
    .slice(0, 4);

  const shopPool = targetShop
    ? [targetShop, ...candidateShops.filter((shop) => shop.id !== targetShop.id)]
    : candidateShops;

  const recommendedIds = sortShopIdsByDistance(
    Array.from(
      new Set(
        shopIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
      )
    ).slice(0, 3),
    shopPool,
    location
  );

  const recommendedShops = shopPool.filter((shop) => recommendedIds.includes(shop.id));
  const finalRecommendedShops =
    recommendedShops.length > 0 || !shopIntent
      ? recommendedShops
      : shopPool.slice(0, 3);

  const reply =
    buildReplyFromTurns(normalizedTurns) ||
    "うまく答えがまとまらんかったき、もう一回聞いてみてね。";

  const locationType = classifyLocationType(location);
  const intentCategory = classifyIntent(text);
  const logVendorIds = Array.from(
    new Set(
      finalRecommendedShops
        .map((shop) => shop.vendorId)
        .filter((value): value is string => !!value)
    )
  );
  const logIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  if (logVendorIds.length > 0) {
    const logs = logVendorIds.map((vendorId) => ({
      store_id: vendorId,
      question_text: text ? maskPii(text) : "(画像のみ)",
      intent_category: intentCategory,
      keywords,
      location_type: locationType,
      is_recommendation: true,
      ip_address: logIp,
      visitor_key: visitorKey ?? null,
    }));
    supabase.from("ai_consult_logs").insert(logs).then(({ error }) => {
      if (error) console.error("[ai_consult_logs] insert failed:", error.message);
    });
  } else {
    supabase.from("ai_consult_logs").insert({
      store_id: null,
      question_text: text ? maskPii(text) : "(画像のみ)",
      intent_category: intentCategory,
      keywords,
      location_type: locationType,
      is_recommendation: false,
      ip_address: logIp,
      visitor_key: visitorKey ?? null,
    }).then(({ error }) => {
      if (error) console.error("[ai_consult_logs] insert failed:", error.message);
    });
  }

  const safeFollowUpQuestion = isValidFollowUpQuestion(followUpQuestion ?? "")
    ? followUpQuestion.trim()
    : buildFallbackFollowUpQuestion(text, targetShopName, finalRecommendedShops.length);

  return {
    reply,
    imageUrl: imageUrl ?? undefined,
    shopIds: finalRecommendedShops.map((shop) => shop.id),
    shops: finalRecommendedShops,
    turns: normalizedTurns,
    followUpQuestion: safeFollowUpQuestion,
    memorySummary: summary.trim() || memorySummary,
    retryable: false,
    consultId,
  };
}

async function createStreamingConsultResponse(options: {
  openaiKey: string;
  selectedCharacters: ConsultCharacter[];
  conversationPattern: ReturnType<typeof pickConversationPattern>;
  userContent:
    | string
    | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
  request: Request;
  supabase: SupabaseClient<Database>;
  consultId: string;
  text: string;
  keywords: string[];
  location: { lat: number; lng: number } | null;
  visitorKey: string | null;
  targetShopName: string | null;
  targetShop: Shop | null;
  candidateShops: Shop[];
  shopIntent: boolean;
  memorySummary: string;
}): Promise<Response> {
  const {
    openaiKey,
    selectedCharacters,
    conversationPattern,
    userContent,
    request,
    supabase,
    consultId,
    text,
    keywords,
    location,
    visitorKey,
    targetShopName,
    targetShop,
    candidateShops,
    shopIntent,
    memorySummary,
  } = options;

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 500,
      stream: true,
      messages: [
        {
          role: "system",
          content: buildGrandmaAiSystemPrompt(
            selectedCharacters,
            [
              buildConversationPatternPrompt(selectedCharacters, conversationPattern),
              buildStreamingFormatPrompt(selectedCharacters, conversationPattern),
            ].join("\n\n")
          ),
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      buildErrorResponse(
        "system_error",
        selectedCharacters,
        "いま少し混みゆうみたい。少しおいて、もう一回聞いてみてね。",
        {
          retryable: true,
          errorMessage: "相談の送信に失敗しました。通信状況を確認して、もう一度試してください。",
          memorySummary,
        }
      ),
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const readable = new ReadableStream({
    async start(controller) {
      const enqueue = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      const reader = upstream.body!.getReader();
      let sseBuffer = "";
      let modelOutput = "";
      let firstTurnStarted = false;
      let firstTurnTextLength = 0;

      const emitFirstTurnProgress = () => {
        const firstLine = modelOutput.split(/\r?\n/, 1)[0]?.replace(/\r/g, "") ?? "";
        if (!firstLine.startsWith("TURN|")) return;
        const parts = firstLine.split("|");
        if (parts.length < 4) return;
        const requestedSpeakerId = parts[1].trim() as ConsultCharacterId;
        const matchedCharacter =
          CONSULT_CHARACTER_BY_ID.get(requestedSpeakerId) ??
          selectedCharacters.find((character) => character.id === requestedSpeakerId) ??
          selectedCharacters[0];
        if (!matchedCharacter) return;
        if (!firstTurnStarted) {
          firstTurnStarted = true;
          enqueue({
            type: "first_turn_start",
            speakerId: matchedCharacter.id,
            speakerName: parts[2].trim() || matchedCharacter.name,
          });
        }
        const currentText = parts.slice(3).join("|");
        if (currentText.length <= firstTurnTextLength) return;
        enqueue({
          type: "first_turn_delta",
          delta: currentText.slice(firstTurnTextLength),
        });
        firstTurnTextLength = currentText.length;
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as {
                choices?: { delta?: { content?: string } }[];
              };
              const delta = parsed.choices?.[0]?.delta?.content ?? "";
              if (!delta) continue;
              modelOutput += delta;
              emitFirstTurnProgress();
            } catch {
              // skip malformed chunks
            }
          }
        }

        const streamedPayload = parseStreamingConsultOutput(modelOutput, selectedCharacters);
        const response = await finalizeConsultResponse({
          request,
          supabase,
          consultId,
          text,
          keywords,
          location,
          visitorKey,
          targetShopName,
          targetShop,
          candidateShops,
          turns: streamedPayload.turns,
          shopIds: streamedPayload.shopIds,
          imageUrl: streamedPayload.imageUrl,
          followUpQuestion: streamedPayload.followUpQuestion,
          summary: streamedPayload.summary,
          shopIntent,
          memorySummary,
        });
        enqueue({
          type: "final",
          response,
        });
      } catch {
        enqueue({
          type: "final",
          response: buildErrorResponse(
            "system_error",
            selectedCharacters,
            "いま少し混みゆうみたい。少しおいて、もう一回聞いてみてね。",
            {
              retryable: true,
              errorMessage: "相談の送信に失敗しました。通信状況を確認して、もう一度試してください。",
              memorySummary,
            }
          ),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      // Transfer-Encoding はランタイムが自動付与する。手動指定すると二重に
      // なり、ブラウザ側でチャンク境界の解釈が壊れて final イベントを取り
      // こぼす（curl は許容するがブラウザの fetch/ReadableStream は失敗する）。
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "grandma-ask",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    let parsedReq: ParsedRequest;
    try {
      parsedReq = await parseRequest(request);
    } catch (e) {
      if (e instanceof Error && (e as Error & { statusCode?: number }).statusCode === 400) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
    const {
      text,
      location,
      imageDataUrl,
      targetShopId,
      targetShopName,
      history,
      memorySummary,
      preferredCharacterId,
      visitorKey,
      stream,
    } = parsedReq;
    const question = text || (imageDataUrl ? "画像について教えて" : "");
    if (!question) {
      return NextResponse.json({ reply: "質問を入力してね。" }, { status: 400 });
    }

    const normalized = question.replace(/\s+/g, "");
    const selectedCharacters = pickConsultCharacters(preferredCharacterId);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey) {
      const secClient = createClient<DatabaseWithExtensions>(supabaseUrl, serviceRoleKey);
      // x-real-ip はVercelが設定する信頼できるヘッダー（スプーフィング不可）
      const forwardedIp =
        request.headers.get("x-real-ip") ??
        request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
        null;
      const ip = forwardedIp && forwardedIp !== "unknown" ? forwardedIp : null;
      const abuseResult = await handleAbuseDetection(secClient, ip, text, visitorKey ?? undefined);
      if (abuseResult === "blocked") {
        return NextResponse.json(
          buildErrorResponse(
            "unsupported_request",
            selectedCharacters,
            "申し訳ありませんが、このアクセスはご利用いただけません。"
          ),
          { status: 403 }
        );
      }
    }
    const conversationPattern = pickConversationPattern(selectedCharacters);
    if (normalized.includes("おばあちゃんは何者") || normalized.includes("おばあちゃん何者")) {
      return NextResponse.json({
        reply: "高知の日曜市を案内するにちよさんたちやきね。気軽に聞いてや。",
      });
    }
    if (isUnsupportedQuestion(normalized)) {
      return NextResponse.json(
        buildErrorResponse(
          "unsupported_request",
          selectedCharacters,
          "その相談には答えられんけんど、日曜市のお店や回り方なら一緒に考えられるよ。"
        )
      );
    }
    if (text && text.length < 4 && !imageDataUrl) {
      return NextResponse.json(
        buildErrorResponse(
          "insufficient_context",
          selectedCharacters,
          "もう少し詳しく聞かせてくれたら案内しやすいよ。食べたいものや気になるお店があると分かりやすいきね。"
        )
      );
    }

    const consultId = crypto.randomUUID();

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!supabaseUrl || !serviceRoleKey || !openaiKey) {
      return NextResponse.json(
        buildErrorResponse(
          "system_error",
          selectedCharacters,
          "いま準備が整ってないみたい。少しおいて、もう一回試してみてね。",
          {
            retryable: true,
            errorMessage: "相談の準備がまだ整っていません。少し時間をおいて再試行してください。",
            memorySummary,
          }
        ),
        { status: 500 }
      );
    }

    const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);
    const keywords = extractKeywords(question);
    const shopIntent = isShopRelatedQuestion(normalized);
    const seasonalQuestion = isSeasonalQuestion(normalized);
    const currentSeason = getCurrentSeasonInfo();

    let targetShop: Shop | null = null;
    if (targetShopId) {
      targetShop = await fetchShopByStoreNumber(supabase, targetShopId);
    }
    if (!targetShop && targetShopName) {
      targetShop = await fetchShopByName(supabase, targetShopName);
    }

    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: question,
      }),
    });
    if (!embeddingResponse.ok) {
      return NextResponse.json(
        buildErrorResponse(
          "system_error",
          selectedCharacters,
          "いま少し混みゆうみたい。少しおいて、もう一回聞いてみてね。",
          {
            retryable: true,
            errorMessage: "相談の送信に失敗しました。通信状況を確認して、もう一度試してください。",
            memorySummary,
          }
        ),
        { status: 500 }
      );
    }
    const embeddingPayload = (await embeddingResponse.json()) as {
      data?: { embedding: number[] }[];
    };
    const embedding = embeddingPayload.data?.[0]?.embedding;
    if (!embedding) {
      return NextResponse.json(
        buildErrorResponse(
          "system_error",
          selectedCharacters,
          "いま少し混みゆうみたい。少しおいて、もう一回聞いてみてね。",
          {
            retryable: true,
            errorMessage: "相談の送信に失敗しました。通信状況を確認して、もう一度試してください。",
            memorySummary,
          }
        ),
        { status: 500 }
      );
    }

    const seasonalProducts = seasonalQuestion
      ? await fetchSeasonalProductContext(supabase, currentSeason.seasonId)
      : [];
    const seasonalVendorIds = Array.from(
      new Set(seasonalProducts.map((row) => row.vendorId))
    );

    const candidateVendorIds = shopIntent
      ? await fetchCandidateVendorIds(
          supabase,
          keywords,
          targetShopName,
          embedding,
          seasonalVendorIds
        )
      : [];
    if (targetShop?.vendorId) {
      candidateVendorIds.unshift(targetShop.vendorId);
    }
    const candidateShops = await fetchShopsByVendorIds(
      supabase,
      Array.from(new Set(candidateVendorIds)).slice(0, 12)
    );
    if (
      shopIntent &&
      !targetShop &&
      candidateShops.length === 0 &&
      seasonalProducts.length === 0 &&
      !imageDataUrl
    ) {
      return NextResponse.json(
        buildErrorResponse(
          "no_result",
          selectedCharacters,
          "ぴったり当てはまるお店は見つからんかったけんど、言い方を少し変えると探しやすくなるかもしれんね。"
        )
      );
    }

    const { data: knowledgeMatches } = await supabase
      .rpc("match_knowledge_embeddings", {
        query_embedding: embedding as unknown as string,
        match_count: 3,
        match_threshold: 0.55,
      })
      .returns<{ id: string; similarity: number }[]>();
    const safeKnowledgeMatches = Array.isArray(knowledgeMatches) ? knowledgeMatches : [];
    const knowledgeIds = safeKnowledgeMatches.map((row) => row.id).filter(Boolean);
    let knowledgeRows: KnowledgeRow[] = [];
    if (knowledgeIds.length > 0) {
      const { data } = await supabase
        .from("knowledge_embeddings")
        .select("id, category, title, content, image_url")
        .in("id", knowledgeIds);
      knowledgeRows = (data ?? []) as KnowledgeRow[];
    }

    let storeKnowledgeContext = "";
    const ragVendorIds = Array.from(
      new Set(
        [
          targetShop?.vendorId ?? null,
          ...candidateShops.slice(0, 3).map((shop) => shop.vendorId ?? null),
        ].filter((value): value is string => !!value)
      )
    );
    if (ragVendorIds.length > 0) {
      const knowledgeResults = await Promise.all(
        ragVendorIds.map(async (vendorId) => {
          const result = await supabase.rpc("match_store_knowledge", {
            query_embedding: embedding as unknown as string,
            target_store_id: vendorId,
            match_count: 2,
            match_threshold: 0.45,
          });
          return result as { data: { content: string; similarity: number }[] | null };
        })
      );
      const snippets = knowledgeResults
        .flatMap((result) => result.data ?? [])
        .sort((a, b) => b.similarity - a.similarity)
        .map((row) => row.content)
        .filter(Boolean);
      if (snippets.length > 0) {
        storeKnowledgeContext = snippets.join("\n---\n");
      }
    }

    const knowledgeContext =
      knowledgeRows.length > 0
        ? knowledgeRows
            .map((row) => {
              return [
                `id:${row.id}`,
                row.category ? `category:${row.category}` : null,
                row.title ? `title:${row.title}` : null,
                row.content ? `content:${row.content}` : null,
                row.image_url ? `image_url:${row.image_url}` : null,
              ]
                .filter(Boolean)
                .join(" | ");
            })
            .join("\n")
        : "該当なし";

    const userContextText = [
      buildHistoryContext(history, memorySummary),
      `今回の質問: ${text || "（画像についての相談）"}`,
      `位置情報: ${location ? `${location.lat}, ${location.lng}` : "不明"}`,
      `現在の季節: ${currentSeason.seasonName}`,
      targetShop
        ? `注目中の店舗: id:${targetShop.id} | name:${targetShop.name}`
        : "注目中の店舗: なし",
      `店舗候補:\n${summarizeShops(targetShop ? [targetShop, ...candidateShops.filter((shop) => shop.id !== targetShop.id)] : candidateShops)}`,
      `季節の候補:\n${
        seasonalProducts.length > 0
          ? seasonalProducts
              .map(
                (row) =>
                  `shop:${row.shopName || "店舗名不明"} | product:${row.productName} | season:${row.seasonName}`
              )
              .join("\n")
          : "該当なし"
      }`,
      `共通知識:\n${knowledgeContext}`,
      `出店者知識:\n${storeKnowledgeContext || "該当なし"}`,
      `選ばれた話者: ${selectedCharacters.map((character) => character.name).join(" / ")}`,
    ].join("\n\n");

    const userContent:
      | string
      | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> =
      imageDataUrl
        ? [
            { type: "text", text: `${userContextText}\n画像が添付されています。` },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ]
        : userContextText;

    if (stream) {
      return createStreamingConsultResponse({
        openaiKey,
        selectedCharacters,
        conversationPattern,
        userContent,
        request,
        supabase,
        consultId,
        text,
        keywords,
        location,
        visitorKey,
        targetShopName,
        targetShop,
        candidateShops,
        shopIntent,
        memorySummary,
      });
    }

    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 500,
        response_format: buildResponseSchema(selectedCharacters, conversationPattern),
        messages: [
          {
            role: "system",
            content: buildGrandmaAiSystemPrompt(
              selectedCharacters,
              buildConversationPatternPrompt(selectedCharacters, conversationPattern)
            ),
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });
    if (!chatResponse.ok) {
      return NextResponse.json(
        buildErrorResponse(
          "system_error",
          selectedCharacters,
          "いま少し混みゆうみたい。少しおいて、もう一回聞いてみてね。",
          {
            retryable: true,
            errorMessage: "相談の送信に失敗しました。通信状況を確認して、もう一度試してください。",
            memorySummary,
          }
        ),
        { status: 500 }
      );
    }

    const chatPayload = (await chatResponse.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const rawStructured =
      chatPayload.choices?.[0]?.message?.content?.trim() ?? "";
    const structured = JSON.parse(rawStructured) as import("@/lib/grandma/types").StructuredConsultResponse;

    const turns: ConsultTurn[] = (structured.turns ?? [])
      .map((turn) => {
        const character = CONSULT_CHARACTER_BY_ID.get(turn.speakerId);
        if (!character) return null;
        return {
          speakerId: character.id,
          speakerName: character.name,
          text: String(turn.text ?? "").trim(),
        } satisfies ConsultTurn;
      })
      .filter((turn): turn is ConsultTurn => !!turn && turn.text.length > 0)
      .slice(0, 4);
    const response = await finalizeConsultResponse({
      request,
      supabase,
      consultId,
      text,
      keywords,
      location,
      visitorKey,
      targetShopName,
      targetShop,
      candidateShops,
      turns,
      shopIds: structured.shopIds ?? [],
      imageUrl: structured.imageUrl,
      followUpQuestion: structured.followUpQuestion ?? "",
      summary: structured.summary ?? "",
      shopIntent,
      memorySummary,
    });

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      {
        reply: "にちよさん: いま少し混みゆうみたい。少しおいて、もう一回聞いてみてね。",
        turns: [
          {
            speakerId: "nichiyosan",
            speakerName: "にちよさん",
            text: "いま少し混みゆうみたい。少しおいて、もう一回聞いてみてね。",
          },
        ],
        errorCode: "system_error",
        retryable: true,
        errorMessage: "接続に失敗しました。少し時間をおいて、もう一度試してください。",
      },
      { status: 500 }
    );
  }
}
