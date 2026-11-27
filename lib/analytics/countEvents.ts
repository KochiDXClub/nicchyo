/**
 * /api/analytics/count が受け付ける「件数だけを数える」計測（#1069）。
 * 種類（kind）ごとに受け付ける値を決め、それ以外は捨てる。種類を足すときは、
 * ここに型と case を足し、route.ts の countTarget にも case を足す。
 */

/** 利用回数を数える機能。DB の usage_daily.feature の CHECK と揃える */
export const USAGE_FEATURES = ["map", "consult", "search", "shop"] as const;
export type UsageFeature = (typeof USAGE_FEATURES)[number];

export type CountEvent = { kind: "usage"; feature: UsageFeature };

/** API が受け取った body を検証する。知らない種類・値・余計なキーがあれば null */
export function parseCountEvent(body: unknown): CountEvent | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  switch (record.kind) {
    case "usage": {
      if (Object.keys(record).some((key) => key !== "kind" && key !== "feature")) return null;
      const feature = record.feature as UsageFeature;
      if (!USAGE_FEATURES.includes(feature)) return null;
      return { kind: "usage", feature };
    }
    default:
      return null;
  }
}
