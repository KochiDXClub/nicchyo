export type ItineraryShop = {
  /** 実在の店舗ID。候補と突合できなかった立ち寄りは 0（マップ連携から除外される） */
  id: number;
  name?: string;
  /** 表示用の "HH:MM"。タイムゾーン依存を避けるため ISO ではなく文字列で持つ */
  time: string;
};
export type ItineraryPlan = { title: string; summary?: string; shops: ItineraryShop[] };
export type ItineraryTemplateInput = {
  stops: number;
  startAt: string;
  interest: string;
};

const TEMPLATE_HEADER = "【おさんぽプラン】";
const SECTION_OVERVIEW = "■ 概要";
const SECTION_TIMELINE = "■ タイムライン";
const SECTION_NOTES = "■ メモ";
const SECTION_ROUTE = "■ ルート案内";

const DEFAULT_INTERVAL_MINUTES = 20;

export function buildItineraryTemplate(input: ItineraryTemplateInput) {
  return [
    TEMPLATE_HEADER,
    SECTION_OVERVIEW,
    `テーマ: ${input.interest || "日曜市さんぽ"}`,
    `開始時刻: ${input.startAt}`,
    `立ち寄り件数: ${input.stops}件`,
    SECTION_TIMELINE,
    "1. HH:MM | 店名 | ここですること",
    "2. HH:MM | 店名 | ここですること",
    "3. HH:MM | 店名 | ここですること",
    SECTION_NOTES,
    "- 持ち物: 例) エコバッグ、保冷バッグ",
    "- 混雑対策: 例) 早めの時間帯に人気店へ",
    SECTION_ROUTE,
    "- スタート: ○○",
    "- ゴール: ○○",
  ].join("\n");
}

function parseHHMM(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

function formatHHMM(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * 開始時刻（"今すぐ" or "HH:MM"）を分に解決する。
 * "今すぐ" の基準時刻はタイムゾーン依存を避けるため呼び出し側が渡す
 * （サーバーは clientTimezone で、クライアントはローカル時刻で計算する）。
 */
function resolveStartMinutes(startAt: string, nowHHMM: string): number {
  return parseHHMM(startAt) ?? parseHHMM(nowHHMM) ?? 10 * 60;
}

export function parseItineraryTemplateOutput(
  outputText: string,
  fallback: { startAt: string; interest: string; stops: number; nowHHMM: string }
): ItineraryPlan {
  const baseMinutes = resolveStartMinutes(fallback.startAt, fallback.nowHHMM);

  const lines = outputText.split(/\r?\n/).map((line) => line.trim());
  const timeline = lines.filter((line) => /^\d+\.\s*/.test(line));
  const shops: ItineraryShop[] = timeline
    .map((line, index) => {
      const body = line.replace(/^\d+\.\s*/, "");
      const parts = body.split("|").map((p) => p.trim());
      const timeMinutes = parseHHMM(parts[0] || "");
      const name = parts[1] || `立ち寄り${index + 1}`;
      return {
        id: 0,
        name,
        time: formatHHMM(
          timeMinutes ?? baseMinutes + index * DEFAULT_INTERVAL_MINUTES
        ),
      };
    })
    .slice(0, Math.max(1, fallback.stops));

  if (shops.length === 0) {
    for (let i = 0; i < Math.max(1, fallback.stops); i += 1) {
      shops.push({
        id: 0,
        name: `立ち寄り${i + 1}`,
        time: formatHHMM(baseMinutes + i * DEFAULT_INTERVAL_MINUTES),
      });
    }
  }

  const themeLine = lines.find((line) => line.startsWith("テーマ:"));
  const summary = (themeLine?.replace(/^テーマ:\s*/, "").trim() || fallback.interest || "").trim();
  const title = `${fallback.startAt}のおさんぽプラン`;
  return { title, summary, shops };
}

/**
 * LLM出力から作ったプランの店名を、実在の候補店舗と突合して実IDに解決する。
 * 完全一致 → 部分一致（双方向）の順で照合し、見つからない立ち寄りは id: 0 のまま。
 * 同じ店が複数の立ち寄りに割り当たらないよう、一度使った候補は除外する。
 */
export function resolvePlanShopIds(
  plan: ItineraryPlan,
  candidates: { id: number; name: string }[]
): ItineraryPlan {
  const used = new Set<number>();

  const findMatch = (rawName: string): { id: number; name: string } | null => {
    const name = rawName.trim();
    if (!name) return null;
    const exact = candidates.find((c) => !used.has(c.id) && c.name === name);
    if (exact) return exact;
    const partial = candidates.find(
      (c) =>
        !used.has(c.id) &&
        c.name.length > 0 &&
        (c.name.includes(name) || name.includes(c.name))
    );
    return partial ?? null;
  };

  const shops = plan.shops.map((shop) => {
    if (shop.id > 0) return shop;
    const match = findMatch(shop.name ?? "");
    if (!match) return shop;
    used.add(match.id);
    return { ...shop, id: match.id, name: match.name };
  });

  return { ...plan, shops };
}

export function generateItinerary(options: {
  shopCandidates: { id: number; name?: string }[];
  stops?: number;
  startAt?: string; // "今すぐ" or "HH:MM"
  interest?: string;
  /** "今すぐ" の基準となる現在時刻（"HH:MM"）。省略時はローカル時刻 */
  nowHHMM?: string;
}): ItineraryPlan {
  const stops = Math.max(1, Math.min(6, options.stops ?? 3));
  const candidates = options.shopCandidates ?? [];
  const selected = candidates.slice(0, Math.min(stops, candidates.length));
  const now = new Date();
  const localNowHHMM =
    options.nowHHMM ?? formatHHMM(now.getHours() * 60 + now.getMinutes());
  const startMinutes = resolveStartMinutes(options.startAt ?? "今すぐ", localNowHHMM);

  const shops = selected.map((s, i) => ({
    id: s.id,
    name: s.name,
    time: formatHHMM(startMinutes + i * DEFAULT_INTERVAL_MINUTES),
  }));

  const title = `${options.startAt ?? "今すぐ"}のおさんぽプラン`;
  return { title, summary: options.interest ?? "", shops };
}
