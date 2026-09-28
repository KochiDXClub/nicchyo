'use client';

/**
 * 「おでかけサポート」のデモ。
 *
 * お手洗いへ案内している画面を、本番と同じ部品で組む。
 *   上の案内カード … 本番の GuideNavigationBar そのもの（目的地・徒歩分・いまの指示・くわしく）
 *   お手洗いの印   … 本番の GuideLayer と同じ HTML（facility-marker）。押すと本番と同じ
 *                    スポットカードが開き、「ここへ案内」で案内先が切り替わる
 *   経路の破線     … 本番と同じ太さ・色・破線。案内先へは濃く、ほかの近い所へは薄く
 *   現在地の点     … 本番の現在地マーカー（MapLibreUserLocation）と同じ青い点
 *   下のピル       … 案内をやめたとき。本番でシートをたたんだときと同じ「いちばん近い」の札
 *
 * 場所は本番の座標そのもの（map_landmarks）。地図ライブラリは載せず、実座標を
 * 枠に収まる縮尺で描く（introMiniMap）。向きも本番の地図と同じで、道が縦、
 * 西（高知城側）が上。道の色分けも本番（roadStyle）から引く。
 *
 * 経路と順位の計算は親のフック（useIntroOdekakeGuide）。ここは見た目と操作だけ。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import type { MapSpot } from '@/lib/spots';
import type { LatLng } from '@/lib/facilities/geo';
import { ROAD_STYLE, ROAD_CORRIDOR_HALF_WIDTH_METERS } from '../../config/roadStyle';
import { DEFAULT_MAP_ROUTE_CONFIG } from '../../types/mapRoute';
import GuideNavigationBar from '../GuideNavigationBar';
import { buildFacilityMarkerHtml, ROUTE_CASING, ROUTE_FAINT, ROUTE_STRONG } from '../GuideLayer';
import { IntroDemoFrame } from './IntroStall';
import { createMiniMapProjection, roadUpBearing } from './introMiniMap';
import type { IntroOdekakeGuide } from './useIntroOdekakeGuide';

/** 地図デモと同じ、縦に長い枠 */
const DEFAULT_FRAME_HEIGHT = 500;

/**
 * 印を収める範囲の左右の余白（px）。印の下に出る名札（最大132px）が枠に切れないぶん。
 * 上下は印の大きさと案内カードの高さから出す（投影を作るところを参照）
 */
const FIT_PADDING_X = 72;
/** 印と名札が枠の縁に付かないための余白 */
const FIT_MARGIN = 8;
/** 案内カードの枠からの距離（GuideNavigationBar の top-3） */
const NAV_BAR_TOP = 12;
/** 案内カードの高さがまだ測れていないときの目安 */
const NAV_BAR_FALLBACK_HEIGHT = 140;

/** 横道の幅（m）。会場の道以外は名前も幅も持たないので、見た目だけの値 */
const STREET_WIDTH_METERS = 8;

/** 本番の印と同じ大きさ（GuideLayer） */
const PIN_SIZE = 40;
const PIN_SIZE_SELECTED = 52;
/** 印の下に出る名札のぶん（margin 4px + 名札 22px）。GuideLayer の .facility-marker__label */
const PIN_LABEL_HEIGHT = 26;

/** 枠の中身の大きさ。幅は画面で決まるので測る */
function useFrameSize(): [React.MutableRefObject<HTMLDivElement | null>, { width: number; height: number }] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const next = { width: el.clientWidth, height: el.clientHeight };
      setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

/**
 * 案内カードの高さ。印がその下に収まるよう、投影の上の余白に使う。
 *
 * カードは「スポットをくわしく」で下へ伸びる。伸びるたびに印を詰め直すと地図が
 * 揺れるので、同じ案内先のあいだは測った中でいちばん低い値（＝たたんだ高さ）を使う
 */
function useNavBarHeight(targetId: string | null): [React.MutableRefObject<HTMLDivElement | null>, number] {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);
  const minRef = useRef<{ id: string | null; height: number }>({ id: null, height: 0 });
  useEffect(() => {
    const bar = wrapperRef.current?.firstElementChild;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const measured = bar.getBoundingClientRect().height;
      if (measured <= 0) return;
      const current = minRef.current;
      if (current.id !== targetId || measured < current.height) {
        minRef.current = { id: targetId, height: measured };
        setHeight(measured);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [targetId]);
  return [wrapperRef, height];
}

const toPoints = (points: { x: number; y: number }[]) =>
  points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/** 本番の現在地マーカー（MapLibreUserLocation の MARKER_HTML）と同じ青い点 */
function CurrentLocationDot({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="pointer-events-none absolute z-[4] flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{ left: x, top: y }}
      role="img"
      aria-label="現在地"
    >
      <span
        className="block h-4 w-4 rounded-full border-[3px] border-white shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
        style={{ backgroundColor: '#2563eb' }}
      />
    </div>
  );
}

/**
 * 本番の OdekakeGuidePanel でシートをたたんだときと同じ、いちばん近い所の札。
 * 本番は画面の下に出るが、ここでは案内カードがあった場所（上）に出す。
 * 下に出すと、いちばん下の印の名札に重なる
 */
function NearestPill({ nearest, onClick }: { nearest: NonNullable<IntroOdekakeGuide['nearest']>; onClick: () => void }) {
  const { spot, route } = nearest;
  return (
    <div className="absolute left-1/2 z-[1001] -translate-x-1/2" style={{ top: NAV_BAR_TOP }}>
      <button
        type="button"
        onClick={onClick}
        className="flex max-w-[min(88vw,26rem)] items-center gap-3 rounded-full bg-white py-2 pl-2 pr-4 shadow-[0_8px_24px_rgba(58,58,58,0.18)] ring-1 ring-black/5 transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
      >
        {spot.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spot.iconUrl} alt="" width={36} height={36} className="block drop-shadow-sm" draggable={false} aria-hidden />
        ) : (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: spot.accentColor, fontSize: 18 }}
            aria-hidden
          >
            {spot.emoji}
          </span>
        )}
        <span className="min-w-0 text-left">
          <span className="block truncate text-[14px] font-bold leading-tight text-nicchyo-ink">{spot.name}</span>
          <span className="mt-0.5 block text-[11px] leading-none text-slate-500">いちばん近い</span>
        </span>
        {route && (
          <span className="ml-1 shrink-0 text-[20px] font-black leading-none text-nicchyo-ink tabular-nums">
            {route.walkMinutes}
            <span className="text-[11px] font-bold">分</span>
          </span>
        )}
      </button>
    </div>
  );
}

export default function IntroOdekakeDemo({
  guide,
  frameHeight = DEFAULT_FRAME_HEIGHT,
  onOpenSpot,
}: {
  guide: IntroOdekakeGuide;
  frameHeight?: number;
  /** 印を押したとき。本番と同じく、案内全体の上にスポットカードを開く */
  onOpenSpot: (spot: MapSpot) => void;
}) {
  const [frameRef, size] = useFrameSize();
  /**
   * 枠が画面に入っているか。
   * 案内先の印は本番と同じく脈打つ（影ごと大きくなる）が、影の動きは毎フレームの
   * 塗り直しになる。案内の別の節を読んでいるあいだも裏で動き続けると、指で送る
   * ときの処理が重くなって慣性が弱まるので、画面の外にあるあいだは止める（globals.css）
   */
  const inView = useInView(frameRef, { amount: 0.1 });
  const { origin, ranked, target, nearest, routes, paths } = guide;
  const targetId = target?.spot.id ?? null;
  const [navBarRef, navBarHeight] = useNavBarHeight(targetId);

  // 会場の道（本線）。向きの基準と、道幅の基準に使う
  const market = useMemo(() => paths.find((path) => path.kind === 'market') ?? paths[0] ?? null, [paths]);

  const projection = useMemo(() => {
    if (size.width === 0 || size.height === 0) return null;
    const fit: LatLng[] = [origin.point, ...ranked.map((entry) => entry.spot)];
    // 上は案内カードの下に、下は名札まで含めて、いちばん大きい印がまるごと入る高さ
    const pinRadius = PIN_SIZE_SELECTED / 2;
    return createMiniMapProjection({
      upBearing: roadUpBearing(market?.points ?? []),
      fit,
      width: size.width,
      height: size.height,
      padding: {
        top: NAV_BAR_TOP + (navBarHeight || NAV_BAR_FALLBACK_HEIGHT) + pinRadius + FIT_MARGIN,
        bottom: pinRadius + PIN_LABEL_HEIGHT + FIT_MARGIN,
        left: FIT_PADDING_X,
        right: FIT_PADDING_X,
      },
    });
  }, [market, navBarHeight, origin.point, ranked, size.height, size.width]);
  const roadWidthPx = (projection?.pxPerMeter ?? 0) * DEFAULT_MAP_ROUTE_CONFIG.roadHalfWidthMeters * 2;
  const corridorWidthPx = (projection?.pxPerMeter ?? 0) * ROAD_CORRIDOR_HALF_WIDTH_METERS * 2;
  const streetWidthPx = (projection?.pxPerMeter ?? 0) * STREET_WIDTH_METERS;

  return (
    // isolate は必須。案内カードは本番の z-index（1001）を持っていて、枠を積み重ねの
    // 単位にしておかないと、あとから案内全体の上に開くスポットカードより手前に浮く
    <IntroDemoFrame height={frameHeight} className="isolate">
      <div
        ref={frameRef}
        className="intro-odekake-demo absolute inset-0"
        data-inview={inView ? 'true' : 'false'}
        style={{ backgroundColor: '#ece5d8' }}
      >
        {projection && (
          <>
            {/* 道と経路。ピクセル座標の折れ線をそのまま描く */}
            <svg className="absolute inset-0 h-full w-full" width={size.width} height={size.height} aria-hidden>
              {/* 会場の道。縁 → 屋台の帯 → 中央の通路 → 中央線の順に重ねる（本番の塗り分けと同じ） */}
              {paths.map((path) => {
                const pts = toPoints(path.points.map(projection.project));
                if (path.kind !== 'market') {
                  return (
                    <g key={path.id}>
                      <polyline points={pts} fill="none" stroke={ROAD_STYLE.edgeColor} strokeOpacity={ROAD_STYLE.edgeOpacity} strokeWidth={streetWidthPx + 2} strokeLinejoin="round" />
                      <polyline points={pts} fill="none" stroke={ROAD_STYLE.corridorColor} strokeWidth={streetWidthPx} strokeLinejoin="round" />
                    </g>
                  );
                }
                return (
                  <g key={path.id}>
                    <polyline points={pts} fill="none" stroke={ROAD_STYLE.edgeColor} strokeOpacity={ROAD_STYLE.edgeOpacity} strokeWidth={roadWidthPx + 3} strokeLinejoin="round" />
                    <polyline points={pts} fill="none" stroke={ROAD_STYLE.surfaceColor} strokeWidth={roadWidthPx} strokeLinejoin="round" />
                    <polyline points={pts} fill="none" stroke={ROAD_STYLE.corridorColor} strokeWidth={corridorWidthPx} strokeLinejoin="round" />
                    <polyline points={pts} fill="none" stroke={ROAD_STYLE.laneColor} strokeOpacity={ROAD_STYLE.laneOpacity} strokeWidth={1.5} strokeDasharray="10 8" strokeLinejoin="round" />
                  </g>
                );
              })}

              {/* 経路。薄い線 → 濃い線の順（濃い線が上に来る）。太さ・破線は本番の GuideLayer と同じ */}
              {[...routes]
                .sort((a, b) => Number(a.emphasis === 'strong') - Number(b.emphasis === 'strong'))
                .map((route) => {
                  const pts = toPoints(route.points.map(projection.project));
                  const style = route.emphasis === 'strong' ? ROUTE_STRONG : ROUTE_FAINT;
                  return (
                    <g key={route.id}>
                      {route.emphasis === 'strong' && (
                        <polyline points={pts} fill="none" stroke={ROUTE_CASING.color} strokeOpacity={ROUTE_CASING.opacity} strokeWidth={ROUTE_CASING.weight} strokeLinecap="round" strokeLinejoin="round" />
                      )}
                      <polyline
                        points={pts}
                        fill="none"
                        stroke={route.color}
                        strokeOpacity={style.opacity}
                        strokeWidth={style.weight}
                        strokeDasharray={style.dash.join(' ')}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })}
            </svg>

            {/* お手洗いの印。本番の GuideLayer と同じ HTML。案内先はひとまわり大きく脈打つ */}
            {ranked.map((entry) => {
              const { spot } = entry;
              const isTarget = spot.id === targetId;
              const size = isTarget ? PIN_SIZE_SELECTED : PIN_SIZE;
              const p = projection.project(spot);
              return (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => onOpenSpot(spot)}
                  aria-label={`${spot.name}を開く`}
                  className="facility-marker-container absolute appearance-none border-0 bg-transparent p-0"
                  style={{
                    left: p.x,
                    top: p.y,
                    // 本番と同じく、印（丸）の中心が座標に来るようにする。名札はその下に出る
                    transform: `translate(-50%, -${size / 2}px)`,
                    zIndex: isTarget ? 2 : 1,
                  }}
                  dangerouslySetInnerHTML={{ __html: buildFacilityMarkerHtml(spot, isTarget) }}
                />
              );
            })}

            <CurrentLocationDot {...projection.project(origin.point)} />
          </>
        )}
      </div>

      {/* 案内中は案内カード、やめたらいちばん近い所の札（本番と同じ切り替わり） */}
      {target ? (
        <div ref={navBarRef} className="contents">
          <GuideNavigationBar target={target} originLabel={origin.label} arrived={false} progress={0} onStop={guide.stop} />
        </div>
      ) : (
        nearest && <NearestPill nearest={nearest} onClick={() => guide.navigateTo(nearest.spot)} />
      )}
    </IntroDemoFrame>
  );
}
