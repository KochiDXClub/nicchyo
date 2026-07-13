import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database.types";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { fetchShopsByVendorIds, summarizeShops } from "@/lib/grandma/vendorSearch";
import {
  buildItineraryTemplate,
  parseItineraryTemplateOutput,
  type ItineraryPlan,
} from "@/lib/itinerary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  stops: z.number().int().min(1).max(6).optional(),
  startAt: z.string().min(1).max(20).optional(),
  interest: z.string().max(200).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() })).optional(),
  memorySummary: z.string().max(800).optional(),
});

type VectorMatch = {
  vendor_id: string;
  similarity: number;
};

export async function POST(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "grandma-itinerary",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid body" }, { status: 400 });
    }

    const stops = parsed.data.stops ?? 3;
    const startAt = parsed.data.startAt?.trim() || "今すぐ";
    const interest = parsed.data.interest?.trim() || "";
    const memorySummary = parsed.data.memorySummary?.trim() || "";
    const history = parsed.data.history ?? [];
    const historyText = history
      .slice(-6)
      .map((h) => `${h.role}: ${h.text}`)
      .join("\n");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!supabaseUrl || !serviceRoleKey || !openaiKey) {
      return NextResponse.json({ error: "server config missing" }, { status: 500 });
    }

    const queryText = `日曜市おさんぽプラン。興味:${interest || "未指定"} 開始:${startAt} 立ち寄り:${stops}`;
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: queryText,
      }),
    });
    if (!embeddingResponse.ok) {
      return NextResponse.json({ error: "embedding failed" }, { status: 500 });
    }
    const embeddingPayload = (await embeddingResponse.json()) as { data?: { embedding: number[] }[] };
    const embedding = embeddingPayload.data?.[0]?.embedding;
    if (!embedding) {
      return NextResponse.json({ error: "embedding not found" }, { status: 500 });
    }

    const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);
    const { data: vectorMatches } = await supabase
      .rpc("match_vendor_embeddings", {
        query_embedding: embedding as unknown as string,
        match_count: 10,
        match_threshold: 0.35,
      })
      .returns<VectorMatch[]>();
    const safeMatches = Array.isArray(vectorMatches) ? vectorMatches : [];
    const vendorIds = safeMatches.map((m) => m.vendor_id).filter(Boolean);
    const shops = await fetchShopsByVendorIds(supabase, vendorIds);
    const matchByVendor = new Map(safeMatches.map((m) => [m.vendor_id, m.similarity]));
    const vectorContext = shops
      .slice(0, 10)
      .map((shop) => {
        const sim = shop.vendorId ? matchByVendor.get(shop.vendorId) : undefined;
        return `id:${shop.id} | name:${shop.name} | category:${shop.category} | similarity:${sim?.toFixed(4) ?? "n/a"} | products:${shop.products.slice(0, 4).join(" / ")}`;
      })
      .join("\n");

    const template = buildItineraryTemplate({ stops, startAt, interest });
    const prompt = [
      "あなたは高知・日曜市の旅程プランナーです。",
      "必ず下記テンプレート構造のテキストのみを出力してください。JSONは禁止。",
      "タイムラインは必ず立ち寄り件数ぶん作ること。",
      "店名は候補店舗から優先して選び、時間は HH:MM 形式で記載すること。",
      "要件:",
      `- 立ち寄り件数: ${stops}`,
      `- 開始時刻: ${startAt}`,
      `- 興味: ${interest || "未指定"}`,
      "",
      "会話メモ:",
      memorySummary || "なし",
      "",
      "直近会話:",
      historyText || "なし",
      "",
      "候補店舗:",
      summarizeShops(shops),
      "",
      "ベクトル近傍情報:",
      vectorContext || "該当なし",
      "",
      "テンプレート:",
      template,
    ].join("\n");

    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "あなたは日曜市の旅程作成AI。出力はテンプレート準拠テキストのみ。説明文や前置き、Markdownの追加装飾は禁止。",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!chatResponse.ok) {
      return NextResponse.json({ error: "chat completion failed" }, { status: 500 });
    }
    const chatPayload = (await chatResponse.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const outputText = chatPayload.choices?.[0]?.message?.content?.trim() || template;
    const plan: ItineraryPlan = parseItineraryTemplateOutput(outputText, {
      startAt,
      interest,
      stops,
    });

    return NextResponse.json({
      plan,
      outputText,
      vectorMatches: shops.slice(0, 6).map((shop) => ({
        id: shop.id,
        name: shop.name,
        category: shop.category,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to build itinerary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

