export type ItineraryShop = { id: number; name?: string; time: string };
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

function toIsoTime(baseDate: Date, hhmm: string) {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return baseDate.toISOString();
  const d = new Date(baseDate);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.toISOString();
}

export function parseItineraryTemplateOutput(
  outputText: string,
  fallback: { startAt: string; interest: string; stops: number }
): ItineraryPlan {
  const now = new Date();
  const base = new Date(now);
  if (fallback.startAt !== "今すぐ") {
    const m = fallback.startAt.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      base.setHours(Number(m[1]), Number(m[2]), 0, 0);
    }
  }

  const lines = outputText.split(/\r?\n/).map((line) => line.trim());
  const timeline = lines.filter((line) => /^\d+\.\s*/.test(line));
  const shops: ItineraryShop[] = timeline
    .map((line, index) => {
      const body = line.replace(/^\d+\.\s*/, "");
      const parts = body.split("|").map((p) => p.trim());
      const timeText = parts[0] || "";
      const name = parts[1] || `立ち寄り${index + 1}`;
      const iso = /^\d{1,2}:\d{2}$/.test(timeText)
        ? toIsoTime(base, timeText)
        : new Date(base.getTime() + index * 20 * 60 * 1000).toISOString();
      return { id: 900000 + index, name, time: iso };
    })
    .slice(0, Math.max(1, fallback.stops));

  if (shops.length === 0) {
    for (let i = 0; i < Math.max(1, fallback.stops); i += 1) {
      shops.push({
        id: 910000 + i,
        name: `立ち寄り${i + 1}`,
        time: new Date(base.getTime() + i * 20 * 60 * 1000).toISOString(),
      });
    }
  }

  const themeLine = lines.find((line) => line.startsWith("テーマ:"));
  const summary = (themeLine?.replace(/^テーマ:\s*/, "").trim() || fallback.interest || "").trim();
  const title = `${fallback.startAt}のおさんぽプラン`;
  return { title, summary, shops };
}

export function generateItinerary(options: {
  shopCandidates: { id: number; name?: string }[];
  stops?: number;
  startAt?: string; // "今すぐ" or "HH:MM"
  interest?: string;
}): ItineraryPlan {
  const stops = Math.max(1, Math.min(6, options.stops ?? 3));
  const candidates = options.shopCandidates ?? [];
  const selected = candidates.slice(0, Math.min(stops, candidates.length));
  const now = new Date();
  const startDate = new Date(now);
  if (options.startAt && options.startAt !== "今すぐ") {
    const m = options.startAt.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      startDate.setHours(hh, mm, 0, 0);
      // if start time is earlier than now, assume next day
      if (startDate.getTime() < now.getTime()) {
        startDate.setDate(startDate.getDate() + 1);
      }
    }
  }

  const intervalMinutes = 20;
  const shops = selected.map((s, i) => {
    const time = new Date(startDate.getTime() + i * intervalMinutes * 60 * 1000);
    return { id: s.id, name: s.name, time: time.toISOString() };
  });

  const title = `${options.startAt ?? '今すぐ'}のおさんぽプラン`;
  return { title, summary: options.interest ?? '', shops };
}
