'use client';

/**
 * BackToMarketButton
 *
 * 地図をフリックして日曜市の道が画面から外れたときに出す「日曜市にもどる」ボタン。
 * 押すと、いまの倍率のまま道のいちばん近いところへ戻る（迷子にしない）。
 *
 * 道が画面に入っているかは、道の点を画面座標に直し、道の区間（枝道を含む）の線分が
 * 画面の矩形に触れているかで判定する（寄っているときは点と点の間だけが映ることがあるので、
 * 点だけでなく線分で見る）。判定は moveend ごとにだけ行う。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { MapCamera } from '../types/mapCamera';
import type { MapRoute } from '../types/mapRoute';
import { getDefaultMapRoutePoints, getRouteTopology, normalizeMapRoutePoints } from '../utils/mapRouteGeometry';
import { cn } from '@/lib/utils/cn';
import MapBottomPrompt, { MAP_BOTTOM_PROMPT_BUTTON_CLASS } from './MapBottomPrompt';

type Point = { x: number; y: number };
type Rect = { left: number; top: number; right: number; bottom: number };

/**
 * 道の中心線からこの距離（m）までは「市場が見えている」扱いにする。
 * 屋台は中心線から 10m ほど脇に並ぶので、寄っていると中心線が画面の外でも屋台は見えている
 */
const MARKET_MARGIN_METERS = 40;
/** 道が外れてからボタンを出すまでの待ち（ms）。道への吸着などで一瞬外れたときにチラつかせない */
const SHOW_DELAY_MS = 400;

export function segmentTouchesRect(a: Point, b: Point, r: Rect): boolean {
  // Liang–Barsky で線分を矩形に切り取れるかを見る
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const checks: Array<[number, number]> = [
    [-dx, a.x - r.left],
    [dx, r.right - a.x],
    [-dy, a.y - r.top],
    [dy, r.bottom - a.y],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return true;
}

/** 画面座標の点 p に一番近い、線分 ab 上の点（0〜1 の割合） */
export function closestRatioOnSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  return Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
}

type LatLng = { lat: number; lng: number };
type Segment = [LatLng, LatLng];

/** 道の区間（本線と枝道）。枝道の先と次の本線の点を誤ってつながないよう、トポロジーの区間を使う */
function useRouteSegments(mapRoute: MapRoute | undefined): Segment[] {
  return useMemo(() => {
    const normalized = normalizeMapRoutePoints(mapRoute?.points ?? []);
    const pts = normalized.length >= 2 ? normalized : getDefaultMapRoutePoints();
    return getRouteTopology(pts).segments.map((seg): Segment => [
      { lat: seg.start.lat, lng: seg.start.lng },
      { lat: seg.end.lat, lng: seg.end.lng },
    ]);
  }, [mapRoute]);
}

function toScreen(map: MapCamera, segments: Segment[]): Array<[Point, Point]> {
  return segments.map(([a, b]) => [
    map.latLngToContainerPoint([a.lat, a.lng]),
    map.latLngToContainerPoint([b.lat, b.lng]),
  ]);
}

/** 道が画面の外に出ているかどうか（地図が止まるたびに更新） */
function useMarketOffscreen(map: MapCamera | null, segments: Segment[]): boolean {
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    if (!map || segments.length === 0) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const check = () => {
      clear();
      const el = map.getContainer();
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      // 画面の横 1px が何 m か。そこから「道から 40m」を px に直して、画面の外側へ広げる
      const metersPerPx =
        map.distance(map.containerPointToLatLng([0, h / 2]), map.containerPointToLatLng([w, h / 2])) / w;
      const margin = metersPerPx > 0 ? MARKET_MARGIN_METERS / metersPerPx : 0;
      const rect: Rect = { left: -margin, top: -margin, right: w + margin, bottom: h + margin };
      const visible = toScreen(map, segments).some(([a, b]) => segmentTouchesRect(a, b, rect));
      if (visible) {
        setOffscreen(false);
        return;
      }
      timer = setTimeout(() => setOffscreen(true), SHOW_DELAY_MS);
    };
    check();
    map.on('moveend', check);
    // 動き始めたら待ちを取り消す（出す判定は止まったときにやり直す）
    map.on('movestart', clear);
    return () => {
      clear();
      map.off('moveend', check);
      map.off('movestart', clear);
    };
  }, [map, segments]);
  return offscreen;
}

/**
 * 道が画面の外に出ているかと、道へ戻る操作。
 * 「このへん、なにがある？」と同じ場所にボタンを出すので、ページ側で両方の出し分けに使う
 */
export function useBackToMarket(map: MapCamera | null, mapRoute?: MapRoute) {
  const segments = useRouteSegments(mapRoute);
  const offscreen = useMarketOffscreen(map, segments);

  const goBack = useCallback(() => {
    if (!map || segments.length === 0) return;
    // いまの画面の中心から、道のいちばん近いところへ戻る（倍率はそのまま）
    const el = map.getContainer();
    const center: Point = { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    let best = segments[0][0];
    let bestDist = Infinity;
    toScreen(map, segments).forEach(([a, b], i) => {
      const t = closestRatioOnSegment(center, a, b);
      const d = Math.hypot(a.x + (b.x - a.x) * t - center.x, a.y + (b.y - a.y) * t - center.y);
      if (d >= bestDist) return;
      bestDist = d;
      const [s0, s1] = segments[i];
      best = { lat: s0.lat + (s1.lat - s0.lat) * t, lng: s0.lng + (s1.lng - s0.lng) * t };
    });
    // flyTo だと一度引いてから寄る弧を描き、ズームスライダーまで出てしまうので、倍率を保ったまま滑らせる
    map.setView([best.lat, best.lng], undefined, { duration: 0.6 });
  }, [map, segments]);

  return { offscreen, goBack };
}

export default function BackToMarketButton({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <MapBottomPrompt visible={visible}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        tabIndex={visible ? 0 : -1}
        className={cn(MAP_BOTTOM_PROMPT_BUTTON_CLASS, 'bg-nicchyo-ink pl-3 pr-4 text-white shadow-float')}
      >
        <MapPin className="h-4 w-4 text-nicchyo-accent" strokeWidth={2.4} aria-hidden />
        日曜市にもどる
      </button>
    </MapBottomPrompt>
  );
}
