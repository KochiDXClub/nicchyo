import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database.types";
import { fetchVendorShopsFromDb } from "@/app/(public)/map/services/shopDb";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { MARKET_CENTER } from "@/lib/constants";
import { loadSpotSupport } from "@/lib/guide/spotSupport.server";
import type { SupportSuggestion } from "@/lib/guide/support";

type Answers = {
  purpose?: string;
  needs?: string;
  visitCount?: string;
  favoriteFood?: string;
};

type PlanShop = {
  id: number;
  name: string;
  reason: string;
  icon: string;
};

type PlanResult = {
  title: string;
  summary: string;
  shops: PlanShop[];
  routeHint: string;
  shoppingList: string[];
  /** 出発地点からいちばん近いお手洗い・休けい・電停（おでかけサポートへのリンク付き） */
  support?: SupportSuggestion[];
};

type BaseShop = {
  id: number;
  name: string;
  category: string;
  products: string[];
  lat: number;
  lng: number;
};

const MapAgentBodySchema = z.object({
  answers: z.object({
    purpose: z.string().optional(),
    needs: z.string().optional(),
    visitCount: z.string().optional(),
    favoriteFood: z.string().optional(),
  }).optional(),
  location: z.tuple([z.number(), z.number()]).nullable().optional(),
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

function createReadClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

async function loadShops(): Promise<BaseShop[]> {
  const supabase = createReadClient();
  if (!supabase) return [];
  const shops = await fetchVendorShopsFromDb(supabase);
  return shops.map((shop) => ({
    id: shop.id,
    name: shop.name,
    category: shop.category,
    products: shop.products ?? [],
    lat: shop.lat,
    lng: shop.lng,
  }));
}

function parseVisitCount(raw?: string) {
  if (!raw) return 3;
  const num = Number(String(raw).replace(/[^0-9]/g, ""));
  if (Number.isNaN(num) || num <= 0) return 3;
  return Math.max(2, Math.min(5, num));
}

function keywordsFrom(answers: Answers) {
  const needs = answers.needs?.toLowerCase() ?? "";
  const favorite = answers.favoriteFood?.toLowerCase() ?? "";
  return [
    ...needs.split(/[、,／/・\s]+/).filter(Boolean),
    ...favorite.split(/[、,／/・\s]+/).filter(Boolean),
  ];
}

function rankShops(answers: Answers, shops: BaseShop[]) {
  const keywords = keywordsFrom(answers);

  const scored = shops.map((shop) => {
    const products = shop.products.join(" ").toLowerCase();
    const name = `${shop.name} ${shop.category}`.toLowerCase();
    let score = 0;
    keywords.forEach((kw) => {
      if (kw && products.includes(kw)) score += 3;
      if (kw && name.includes(kw)) score += 2;
    });
    score += Math.random() * 0.3;
    return { shop, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map(({ shop }) => shop);
}

const DEFAULT_ICON = "🛍️";

function toPlanShop(selected: BaseShop): PlanShop {
  return {
    id: selected.id,
    name: selected.name,
    reason: `${selected.category}が得意。おすすめ: ${selected.products.slice(0, 3).join(" / ")}`,
    icon: DEFAULT_ICON,
  };
}

function haversine(a: [number, number], b: [number, number]) {
  const R = 6371e3;
  const [lat1, lon1] = a.map((v) => (v * Math.PI) / 180);
  const [lat2, lon2] = b.map((v) => (v * Math.PI) / 180);
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function orderByDistance(
  start: [number, number],
  list: PlanShop[],
  shops: BaseShop[]
): PlanShop[] {
  const ordered: PlanShop[] = [];
  const remaining = [...list];
  let current = start;

  while (remaining.length) {
    remaining.sort((a, b) => {
      const shopA = shops.find((s) => s.id === a.id);
      const shopB = shops.find((s) => s.id === b.id);
      const distA = shopA ? haversine(current, [shopA.lat, shopA.lng]) : Number.MAX_SAFE_INTEGER;
      const distB = shopB ? haversine(current, [shopB.lat, shopB.lng]) : Number.MAX_SAFE_INTEGER;
      return distA - distB;
    });
    const next = remaining.shift();
    if (!next) break;
    ordered.push(next);
    const shop = shops.find((s) => s.id === next.id);
    if (shop) current = [shop.lat, shop.lng];
  }

  return ordered;
}

function pickShops(answers: Answers, location: [number, number], shops: BaseShop[]): PlanResult {
  const desiredCount = parseVisitCount(answers.visitCount);
  const ranked = rankShops(answers, shops);
  const selected = ranked.slice(0, desiredCount).map(toPlanShop);
  const ordered = orderByDistance(location, selected, shops);

  const summaryParts = [
    answers.purpose && `目的: ${answers.purpose}`,
    answers.needs && `ほしいもの: ${answers.needs}`,
    answers.favoriteFood && `好きな料理: ${answers.favoriteFood}`,
  ].filter(Boolean);

  const routeNames = ordered.map((s) => `🗒️ ${s.name}`).join(" → ");

  return {
    title: answers.purpose
      ? `「${answers.purpose}」向けおすすめルート`
      : "市場さんぽおすすめルート",
    summary: summaryParts.join(" / ") || "市場のおすすめプランをまとめました。",
    shops: ordered,
    routeHint:
      ordered.length > 0
        ? `${routeNames} の順で回ると移動が短く済みます。`
        : "中央通りを北から南へ歩くと全体を見やすいです。",
    shoppingList:
      answers.needs?.split(/[、,／/・\s]+/).filter(Boolean).slice(0, 6) ?? [],
  };
}

function buildPrompt(
  answers: Answers,
  candidates: BaseShop[],
  start: [number, number]
) {
  const lines = candidates.map((shop) => {
    const products = shop.products.slice(0, 6).join(", ");
    return `${shop.name} (id:${shop.id}, category:${shop.category}, products:${products}, lat:${shop.lat.toFixed(
      5
    )}, lng:${shop.lng.toFixed(5)})`;
  });

  return `
あなたは高知の日曜市で買い物ルートを提案する案内AIです。回答は短めに、JSONのみを返してください。
出発地点: lat ${start[0].toFixed(5)}, lng ${start[1].toFixed(5)}
ユーザー入力:
- 目的: ${answers.purpose ?? "未回答"}
- 欲しいもの: ${answers.needs ?? "未回答"}
- 回りたい件数: ${answers.visitCount ?? "未回答"}
- 好きな料理: ${answers.favoriteFood ?? "未回答"}

候補店舗(最大6件):
${lines.join("\n")}

出力JSONの形:
{
  "title": "string",
  "summary": "string",
  "shops": [{ "id": number, "name": "string", "reason": "string", "icon": "string" }],
  "routeHint": "string",
  "shoppingList": ["string", ...]
}
`.trim();
}

async function callOpenAI(
  answers: Answers,
  ranked: BaseShop[],
  start: [number, number]
): Promise<PlanResult | null> {
  if (!OPENAI_API_KEY) return null;

  const topShops = ranked.slice(0, 6);
  const prompt = buildPrompt(answers, topShops, start);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a concise shopping guide for Kochi Sunday Market. Reply only with JSON that matches the requested schema. Keep route hints short and realistic.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as PlanResult;
    if (!parsed || !Array.isArray(parsed.shops)) return null;

    const nameToId = new Map(topShops.map((s) => [s.name.toLowerCase(), s.id]));

    const normalized: PlanShop[] = parsed.shops.slice(0, 6).map((s, idx) => {
      const id =
        typeof s.id === "number"
          ? s.id
          : nameToId.get(String(s.name ?? "").toLowerCase()) ?? topShops[idx]?.id ?? idx + 1;
      const source = topShops.find((shop) => shop.id === id);
      return {
        id,
        name: s.name ?? source?.name ?? `おすすめ${idx + 1}`,
        reason: s.reason ?? source?.category ?? "おすすめのお店",
        icon: s.icon ?? DEFAULT_ICON,
      };
    });

    const ordered = orderByDistance(start, normalized, ranked);

    return {
      title: parsed.title || "市場さんぽおすすめルート",
      summary: parsed.summary || "市場のおすすめプランをまとめました。",
      shops: ordered,
      routeHint:
        ordered.length > 0
          ? `${ordered.map((s) => `🗒️ ${s.name}`).join(" → ")} の順で回ると移動が短く済みます。`
          : parsed.routeHint || "中央通りから北→南に歩くと全体を見やすいです。",
      shoppingList: Array.isArray(parsed.shoppingList) ? parsed.shoppingList.slice(0, 8) : [],
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "map-agent",
      limit: 15,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const parsed = MapAgentBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }
    const answers: Answers = parsed.data.answers ?? {};
    const start = parsed.data.location ?? MARKET_CENTER;

    const readClient = createReadClient();
    const [baseShops, spotSupport] = await Promise.all([
      loadShops(),
      readClient
        ? loadSpotSupport(readClient, { lat: start[0], lng: start[1] })
        : Promise.resolve({ suggestions: [], prompt: "" }),
    ]);
    const ranked = rankShops(answers, baseShops);
    const aiPlan = await callOpenAI(answers, ranked, start);
    const plan = aiPlan ?? pickShops(answers, start, baseShops);
    return NextResponse.json({ ...plan, support: spotSupport.suggestions }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "failed to build plan" }, { status: 500 });
  }
}
