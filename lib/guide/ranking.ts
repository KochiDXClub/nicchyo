/**
 * スポットの選定（どれを勧めるか）
 *
 * 距離だけでなく、次を加味して並べる:
 *   - 種別（お手洗い / 休けい / のりもの / 目印）と複数選択
 *   - 条件タグ（「屋根あり」「多目的あり」…）の必須・優先
 *   - 利用できる時間帯（open_from / open_until）。時間外は後ろに回す
 *   - 座標が未確認のスポットは同じ距離なら少し後ろ
 *
 * スコアは「徒歩分」を基準にした小さいほど良い値。起点が無いときは距離0扱いで、
 * 条件だけで並ぶ。
 */

import type { MapSpot, SpotKind } from '@/lib/spots';
import { findGuideRoute } from './routing';
import type { GuideNetwork, GuideOrigin, GuideRoute } from './types';

export type RankOptions = {
  origin: GuideOrigin | null;
  network: GuideNetwork | null;
  kinds: SpotKind[];
  /** すべて満たす必要があるタグ */
  requiredTags?: string[];
  /** どれか1つ満たせばよいタグ */
  requiredAnyTags?: string[];
  /** 満たすと優先されるタグ */
  preferTags?: string[];
  /** 利用時間の判定に使う現在時刻 */
  now?: Date;
  /** 時間外のスポットを除外する（既定は後ろに回すだけ） */
  hideClosed?: boolean;
  maxResults?: number;
};

export type RankedSpot = {
  spot: MapSpot;
  route: GuideRoute | null;
  /** 小さいほど良い（徒歩分ベース） */
  score: number;
  /** null = 時間の情報なし */
  isOpen: boolean | null;
  /** 並び順の根拠（UI で「時間外」「屋根あり」などのバッジに使う） */
  reasons: string[];
};

const CLOSED_PENALTY_MINUTES = 60;
const UNVERIFIED_PENALTY_MINUTES = 1;
const PREFER_BONUS_MINUTES = 2;

function toMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 利用できる時間帯か。情報が無ければ null */
export function isSpotOpen(spot: Pick<MapSpot, 'openFrom' | 'openUntil'>, now: Date): boolean | null {
  const from = spot.openFrom ? toMinutes(spot.openFrom) : null;
  const until = spot.openUntil ? toMinutes(spot.openUntil) : null;
  if (from === null && until === null) return null;
  const current = now.getHours() * 60 + now.getMinutes();
  if (from !== null && current < from) return false;
  if (until !== null && current >= until) return false;
  return true;
}

function hasAllTags(spot: MapSpot, tags: string[]): boolean {
  const own = new Set(spot.tags ?? []);
  return tags.every((tag) => own.has(tag));
}

function hasAnyTag(spot: MapSpot, tags: string[]): boolean {
  const own = new Set(spot.tags ?? []);
  return tags.some((tag) => own.has(tag));
}

export function rankSpots(spots: MapSpot[], options: RankOptions): RankedSpot[] {
  const now = options.now ?? new Date();
  const kinds = new Set(options.kinds);

  const ranked = spots
    .filter((spot) => kinds.has(spot.kind))
    .filter((spot) => !options.requiredTags?.length || hasAllTags(spot, options.requiredTags))
    .filter((spot) => !options.requiredAnyTags?.length || hasAnyTag(spot, options.requiredAnyTags))
    .map((spot): RankedSpot | null => {
      const isOpen = isSpotOpen(spot, now);
      if (isOpen === false && options.hideClosed) return null;

      const route = options.origin
        ? findGuideRoute(options.origin.point, spot, options.network, {
            originLabel: options.origin.label,
            destinationName: spot.name,
          })
        : null;

      const reasons: string[] = [];
      let score = route?.walkMinutes ?? 0;
      if (isOpen === false) {
        score += CLOSED_PENALTY_MINUTES;
        reasons.push('時間外');
      }
      if (spot.verified === false) {
        score += UNVERIFIED_PENALTY_MINUTES;
        reasons.push('場所はおおよそ');
      }
      const matchedPrefer = (options.preferTags ?? []).filter((tag) => spot.tags?.includes(tag));
      if (matchedPrefer.length > 0) {
        score -= PREFER_BONUS_MINUTES;
        reasons.push(...matchedPrefer);
      }
      return { spot, route, score, isOpen, reasons };
    })
    .filter((entry): entry is RankedSpot => entry !== null)
    .sort(
      (a, b) =>
        a.score - b.score ||
        (a.route?.distanceMeters ?? 0) - (b.route?.distanceMeters ?? 0) ||
        a.spot.name.localeCompare(b.spot.name, 'ja')
    );

  return options.maxResults ? ranked.slice(0, options.maxResults) : ranked;
}
