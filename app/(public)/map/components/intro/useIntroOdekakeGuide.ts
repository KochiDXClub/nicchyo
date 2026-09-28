'use client';

/**
 * 「おでかけサポート」のデモの状態。
 *
 * 本番の useOdekakeGuide を、案内で見せるぶんだけに絞ったもの。
 *   起点   … 日曜市の中心（VENUE_CENTER）に固定。案内を開いただけで位置情報の許可を
 *            求めないため。画面には本番と同じ「現在地」と出す
 *   道     … 会場の道（mapRoute）だけで組む。歩行者ネットワーク（約270KB）は読まない
 *   順位   … 本番と同じ案内エンジン（rankSpots）。近い順・徒歩分・道すじも同じ
 *   経路線 … 本番と同じく、上位数件は薄く、案内先は濃く
 *
 * 案内先は最初いちばん近いお手洗い。やめると案内していない状態になり、
 * いちばん近い所のピルが出る（本番でシートをたたんだときの表示）。
 * スポットカードの「ここへ案内」で別のお手洗いへ切り替わる。
 *
 * 状態を部品（IntroOdekakeDemo）ではなく親（MapIntroPanel）に持たせるのは、
 * スポットカードをデモの枠の中ではなく案内全体の上に開くため。本番も
 * 状態はフック、見た目は部品、という分け方にしている。
 */

import { useCallback, useMemo, useState } from 'react';
import type { Landmark } from '../../types/landmark';
import type { MapRoute } from '../../types/mapRoute';
import type { MapSpot } from '@/lib/spots';
import {
  buildGuideNetworkForMap,
  geolocationOrigin,
  rankSpots,
  VENUE_CENTER,
  type GuideOrigin,
  type GuidePath,
  type RankedSpot,
} from '@/lib/guide';
import type { GuideRouteLine } from '../GuideLayer';
import { pickIntroRestrooms } from './introDemoSpots';

/** 本番（useOdekakeGuide）と同じ。上位何件までルート線を薄く描くか */
const FAINT_ROUTE_COUNT = 3;

export type IntroOdekakeGuide = {
  /** 案内の起点。ラベルは本番の現在地と同じ「現在地」 */
  origin: GuideOrigin;
  /** お手洗い（近い順） */
  ranked: RankedSpot[];
  nearest: RankedSpot | null;
  /** いま案内している先。null なら案内していない */
  target: RankedSpot | null;
  /** 描く経路。本番の GuideLayer と同じ形 */
  routes: GuideRouteLine[];
  /** 会場の道。デモの地図に描く */
  paths: GuidePath[];
  navigateTo: (spot: MapSpot) => void;
  stop: () => void;
  /** 案内を閉じたときに、次に開くときのため最初の状態へ戻す */
  reset: () => void;
};

export function useIntroOdekakeGuide({
  landmarks,
  mapRoute,
}: {
  landmarks: Landmark[] | undefined;
  mapRoute: MapRoute;
}): IntroOdekakeGuide {
  const spots = useMemo(() => pickIntroRestrooms(landmarks), [landmarks]);
  const network = useMemo(() => buildGuideNetworkForMap(null, mapRoute), [mapRoute]);
  // 起点は会場の中心に固定。型は本番の現在地と同じにして、画面の言い回しを揃える
  const origin = useMemo(() => geolocationOrigin(VENUE_CENTER), []);
  const ranked = useMemo(
    () => rankSpots(spots, { origin, network, kinds: ['restroom'] }),
    [network, origin, spots]
  );
  const nearest = ranked[0] ?? null;

  /**
   * 案内先。undefined は「まだ触っていない」＝いちばん近い所へ案内中。
   * null は「やめた」。文字列はスポットカードで選んだ先
   */
  const [targetId, setTargetId] = useState<string | null | undefined>(undefined);
  const target = useMemo(() => {
    if (targetId === undefined) return nearest;
    if (targetId === null) return null;
    return ranked.find((entry) => entry.spot.id === targetId) ?? nearest;
  }, [nearest, ranked, targetId]);

  const routes = useMemo<GuideRouteLine[]>(() => {
    const targetSpotId = target?.spot.id ?? null;
    const faint = ranked
      .slice(0, FAINT_ROUTE_COUNT)
      .filter((entry) => entry.route && entry.spot.id !== targetSpotId)
      .map((entry) => ({
        id: entry.spot.id,
        points: entry.route!.points,
        color: entry.spot.accentColor,
        emphasis: 'faint' as const,
      }));
    const strong = target?.route
      ? [{ id: target.spot.id, points: target.route.points, color: target.spot.accentColor, emphasis: 'strong' as const }]
      : [];
    return [...faint, ...strong];
  }, [ranked, target]);

  const navigateTo = useCallback((spot: MapSpot) => setTargetId(spot.id), []);
  const stop = useCallback(() => setTargetId(null), []);
  const reset = useCallback(() => setTargetId(undefined), []);

  return {
    origin,
    ranked,
    nearest,
    target,
    routes,
    paths: network?.paths ?? [],
    navigateTo,
    stop,
    reset,
  };
}
