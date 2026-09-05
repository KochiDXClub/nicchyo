/**
 * AI（にちよさん・マップAI）向けの「困ったときの案内」
 *
 * 案内エンジンを使って、起点からいちばん近いお手洗い・休けい場所・電停を
 * 1件ずつ求め、会話や買い物プランに添えられる形（一言 + リンク）にする。
 * サーバー側（API ルート）から使う想定なので React には依存しない。
 */

import type { Landmark } from '@/app/(public)/map/types/landmark';
import type { MapRoute } from '@/app/(public)/map/types/mapRoute';
import { landmarkToSpot, type SpotKind } from '@/lib/spots';
import type { LatLng } from '@/lib/facilities/geo';
import { formatDistance } from '@/lib/facilities/nearest';
import { buildGuideNetwork } from './network';
import { buildGuidePaths } from './paths';
import { geolocationOrigin, venueOrigin } from './origin';
import { rankSpots } from './ranking';
import { guideHrefForKind } from './query';
import type { GuideNetwork } from './types';

export type SupportSuggestion = {
  kind: SpotKind;
  /** 「お手洗い」「休けい」「のりもの」 */
  label: string;
  spotName: string;
  walkMinutes: number;
  distanceMeters: number;
  /** 経路が目安（未確認の道を含む）か */
  approximate: boolean;
  /** マップで案内を開くリンク */
  href: string;
};

const SUPPORT_KINDS: Array<{ kind: SpotKind; label: string }> = [
  { kind: 'restroom', label: 'お手洗い' },
  { kind: 'rest', label: '休けい' },
  { kind: 'transit', label: 'のりもの' },
];

export function buildSupportNetwork(mapRoute: MapRoute | null): GuideNetwork | null {
  return mapRoute ? buildGuideNetwork(buildGuidePaths(mapRoute)) : null;
}

/**
 * 起点からいちばん近いお手洗い・休けい・電停を1件ずつ返す。
 * 起点が無ければ会場の中心から。
 */
export function buildSupportSuggestions(
  landmarks: Landmark[],
  network: GuideNetwork | null,
  origin: LatLng | null,
  now: Date = new Date()
): SupportSuggestion[] {
  const spots = landmarks.map(landmarkToSpot);
  const guideOrigin = origin ? geolocationOrigin(origin) : venueOrigin();
  const suggestions: SupportSuggestion[] = [];

  for (const { kind, label } of SUPPORT_KINDS) {
    const [best] = rankSpots(spots, { origin: guideOrigin, network, kinds: [kind], now, hideClosed: true, maxResults: 1 });
    if (!best?.route) continue;
    suggestions.push({
      kind,
      label,
      spotName: best.spot.name,
      walkMinutes: best.route.walkMinutes,
      distanceMeters: best.route.distanceMeters,
      approximate: best.route.approximate,
      href: guideHrefForKind(kind),
    });
  }
  return suggestions;
}

/** AI のシステムプロンプトに添える、スポットの短い一覧 */
export function buildSpotSupportPrompt(
  landmarks: Landmark[],
  suggestions: SupportSuggestion[]
): string {
  const lines: string[] = [];
  if (suggestions.length > 0) {
    lines.push('【いちばん近い施設（現在地または会場の中心から）】');
    for (const s of suggestions) {
      lines.push(`- ${s.label}: ${s.spotName}（徒歩${s.walkMinutes}分・${formatDistance(s.distanceMeters)}${s.approximate ? '・目安' : ''}） → ${s.href}`);
    }
  }
  const spots = landmarks.map(landmarkToSpot).filter((spot) => spot.kind !== 'shop');
  if (spots.length > 0) {
    lines.push('【日曜市周辺のスポット】');
    for (const spot of spots) {
      const extras = [
        spot.lines && spot.lines.length > 0 ? `路線: ${spot.lines.join('・')}` : null,
        spot.tags && spot.tags.length > 0 ? spot.tags.join('・') : null,
        spot.openFrom || spot.openUntil ? `利用時間 ${spot.openFrom ?? ''}〜${spot.openUntil ?? ''}` : null,
      ].filter(Boolean);
      lines.push(`- ${spot.name}（${kindLabel(spot.kind)}）${spot.description ? ' ' + spot.description : ''}${extras.length ? ' / ' + extras.join(' / ') : ''}`);
    }
    lines.push('お手洗い・休けい・電停を聞かれたら、上の一覧から近いものを1〜2件、徒歩の目安つきで案内し、マップの案内リンク（/map?guide=... または /map?facility=...）を添える。');
  }
  return lines.join('\n');
}

function kindLabel(kind: SpotKind): string {
  switch (kind) {
    case 'transit':
      return '電停・駅';
    case 'restroom':
      return 'お手洗い';
    case 'rest':
      return '休けい';
    case 'landmark':
      return '目印';
    default:
      return 'お店';
  }
}
