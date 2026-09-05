"use client";

import { ROAD_CONFIG } from "@/app/(public)/map/config/roadConfig";
import { DEFAULT_STALL_PARTS, generateStallSpriteSvg } from "@/app/(public)/map/config/stallParts";
import { resolveStallColors } from "@/app/(public)/map/config/shopCategories";

/**
 * マップの読み込み中に見せる絵。
 *
 * 追手筋の一本道（roadConfig の実座標から起こした形）に店の点を並べ、
 * 読み込みの進み具合に合わせて高知城側から順に点が屋台（マップのマーカーと同じ形、屋根は緑）に変わり、
 * 歩く人が東へ進む。
 * 待っている間に「城から東へ一本道」という市場の形が頭に入るようにする。読ませる文章は置かない。
 */

const VIEW_W = 320;
const VIEW_H = 92;
const PAD_X = 28;
const ROAD_TOP = 26;
const DOT_COUNT = 18;
const DOT_OFFSET = 9;
/** 灯った点に出す屋台の大きさ（viewBox 単位） */
const STALL_SIZE = 15;

/** 屋台の絵。マップの屋台マーカーと同じ描き方で、屋根は緑固定 */
const STALL_COLORS = resolveStallColors(undefined, "#7ED957");
const STALL_HREF = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  generateStallSpriteSvg(
    DEFAULT_STALL_PARTS,
    { roof: STALL_COLORS.base, awningBase: STALL_COLORS.light, awningStripe: STALL_COLORS.base },
    { width: 100, height: 100 }
  )
)}`;

type Point = { x: number; y: number };

/** roadConfig の区間中心線を西（高知城側）→東の順に並べた折れ線 */
function buildRoadPath(): Point[] {
  const segments = [...(ROAD_CONFIG.segments ?? [])].sort((a, b) => b.bounds[0][1] - a.bounds[0][1]);
  if (segments.length === 0) {
    return [
      { x: PAD_X, y: VIEW_H / 2 },
      { x: VIEW_W - PAD_X, y: VIEW_H / 2 },
    ];
  }
  const eastToWest: { lat: number; lng: number }[] = [];
  const first = segments[0];
  eastToWest.push({ lat: first.centerLine, lng: first.bounds[0][1] });
  for (const seg of segments) {
    eastToWest.push({ lat: seg.centerLine, lng: (seg.bounds[0][1] + seg.bounds[1][1]) / 2 });
  }
  const last = segments[segments.length - 1];
  eastToWest.push({ lat: last.centerLine, lng: last.bounds[1][1] });

  const lats = eastToWest.map((p) => p.lat);
  const lngs = eastToWest.map((p) => p.lng);
  const minLng = Math.min(...lngs);
  const maxLat = Math.max(...lats);
  const refLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const metersPerLng = 111_320 * Math.cos((refLat * Math.PI) / 180);
  const metersPerLat = 110_574;
  const meters = eastToWest.map((p) => ({
    x: (p.lng - minLng) * metersPerLng,
    y: (maxLat - p.lat) * metersPerLat,
  }));
  const spanX = Math.max(...meters.map((m) => m.x)) || 1;
  const scale = (VIEW_W - PAD_X * 2) / spanX;
  return meters
    .map((m) => ({ x: PAD_X + m.x * scale, y: ROAD_TOP + m.y * scale }))
    .reverse();
}

const ROAD_PATH = buildRoadPath();
const ROAD_D = ROAD_PATH.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

const SEGMENT_LENGTHS = ROAD_PATH.slice(1).map((p, i) => Math.hypot(p.x - ROAD_PATH[i].x, p.y - ROAD_PATH[i].y));
const TOTAL_LENGTH = SEGMENT_LENGTHS.reduce((sum, l) => sum + l, 0);

/** 折れ線上の位置（0=西端, 1=東端）と、そこでの進行方向に直交する単位ベクトル */
function pointAt(t: number): { point: Point; normal: Point } {
  let remaining = Math.min(Math.max(t, 0), 1) * TOTAL_LENGTH;
  for (let i = 0; i < SEGMENT_LENGTHS.length; i += 1) {
    const len = SEGMENT_LENGTHS[i];
    if (remaining <= len || i === SEGMENT_LENGTHS.length - 1) {
      const a = ROAD_PATH[i];
      const b = ROAD_PATH[i + 1];
      const ratio = len === 0 ? 0 : Math.min(remaining / len, 1);
      const dx = (b.x - a.x) / (len || 1);
      const dy = (b.y - a.y) / (len || 1);
      return {
        point: { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio },
        normal: { x: -dy, y: dx },
      };
    }
    remaining -= len;
  }
  const end = ROAD_PATH[ROAD_PATH.length - 1];
  return { point: end, normal: { x: 0, y: 1 } };
}

const DOTS = Array.from({ length: DOT_COUNT }, (_, i) => {
  const { point, normal } = pointAt((i + 0.5) / DOT_COUNT);
  const side = i % 2 === 0 ? -1 : 1;
  return { x: point.x + normal.x * DOT_OFFSET * side, y: point.y + normal.y * DOT_OFFSET * side };
});

const WEST_END = ROAD_PATH[0];

/** 歩く人（3 コマ）。見た目は従来のローディングと同じ */
const WALKER_FRAMES: Array<Array<[number, number, number, number]>> = [
  [
    [40, 30, 28, 36],
    [40, 30, 52, 34],
    [40, 46, 30, 64],
    [40, 46, 52, 62],
  ],
  [
    [40, 30, 30, 34],
    [40, 30, 54, 38],
    [40, 46, 28, 62],
    [40, 46, 54, 64],
  ],
  [
    [40, 30, 26, 38],
    [40, 30, 54, 36],
    [40, 46, 34, 64],
    [40, 46, 56, 58],
  ],
];
const WALKER_SCALE = 0.42;
/** 歩く人の足元（viewBox の y=64）を道の上に置く */
const WALKER_FOOT_Y = 64;

type MapLoadingScreenProps = {
  /** 0〜1 の進み具合。点の灯りと歩く人の位置に使う */
  progress: number;
};

export default function MapLoadingScreen({ progress }: MapLoadingScreenProps) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const litCount = Math.round(clamped * DOT_COUNT);
  const walker = pointAt(clamped).point;
  const walkerTransform = `translate(${(walker.x - 40 * WALKER_SCALE).toFixed(1)}px, ${(
    walker.y - WALKER_FOOT_Y * WALKER_SCALE - 2
  ).toFixed(1)}px) scale(${WALKER_SCALE})`;

  return (
    <div className="map-loading-silhouette flex w-full max-w-md flex-col items-center gap-4 px-6">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full overflow-visible"
        aria-hidden="true"
        fill="none"
      >
        {/* 道。太い淡色の帯に、細い中心線を重ねる */}
        <path d={ROAD_D} stroke="#f2e4c6" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={ROAD_D}
          stroke="#d3b27a"
          strokeOpacity="0.55"
          strokeWidth="1"
          strokeDasharray="4 5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 店の点。進み具合に合わせて西から順に屋台に変わる */}
        {DOTS.map((dot, i) => {
          const lit = i < litCount;
          return (
            <g key={i} className={`map-loading-dot${lit ? " is-lit" : ""}`}>
              <circle cx={dot.x} cy={dot.y} r={2.6} className="map-loading-dot__core" />
              <image
                href={STALL_HREF}
                x={dot.x - STALL_SIZE / 2}
                y={dot.y - STALL_SIZE * 0.78}
                width={STALL_SIZE}
                height={STALL_SIZE}
                className="map-loading-dot__stall"
              />
            </g>
          );
        })}

        {/* 西端の目印。文字だけの小さな札にとどめる */}
        <g transform={`translate(${WEST_END.x} ${WEST_END.y + 20})`}>
          <rect x="-19" y="-8" width="38" height="16" rx="8" fill="#ffffff" fillOpacity="0.85" stroke="#e8d7b4" />
          <text textAnchor="middle" y="3.5" fontSize="8.5" fill="#8a5a12" fontWeight="600" style={{ letterSpacing: "0.06em" }}>
            高知城
          </text>
        </g>

        {/* 歩く人。進み具合に合わせて城から東へ進む */}
        <g className="map-loading-walker" style={{ transform: walkerTransform }}>
          <g
            className="map-walker"
            stroke="#b45309"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {WALKER_FRAMES.map((lines, frame) => (
              <g key={frame} className={`map-walker-frame is-${frame + 1}`}>
                <circle cx="40" cy="16" r="6" />
                <line x1="40" y1="22" x2="40" y2="46" />
                {lines.map(([x1, y1, x2, y2], i) => (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
                ))}
              </g>
            ))}
          </g>
        </g>
      </svg>

      <div className="flex flex-col items-center gap-1.5">
        <div className="text-xs font-semibold tracking-[0.35em] text-amber-700">LOADING</div>
        <p className="text-[12px] tracking-wide text-amber-800/70">地図を準備しています</p>
      </div>
    </div>
  );
}
