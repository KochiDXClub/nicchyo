"use client";

import { ROAD_CONFIG } from "@/app/(public)/map/config/roadConfig";

/**
 * マップの読み込み中に見せる絵。
 *
 * 追手筋の一本道（roadConfig の実座標から起こした形）に店の点を並べ、
 * 読み込みの進み具合に合わせて高知城側から順に点が灯り、歩く人が東へ進む。
 * 待っている間に「城から東へ一本道」という市場の形が頭に入るようにする。読ませる文章は置かない。
 */

const VIEW_W = 320;
const VIEW_H = 96;
const PAD_X = 28;
const ROAD_TOP = 26;
const DOT_COUNT = 18;
const DOT_OFFSET = 9;

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
const EAST_END = ROAD_PATH[ROAD_PATH.length - 1];

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
    <div className="map-loading-silhouette w-full max-w-sm px-6">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full overflow-visible"
        aria-hidden="true"
        fill="none"
      >
        {/* 道 */}
        <path d={ROAD_D} stroke="#f3dfae" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={ROAD_D}
          stroke="#c2820a"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 店の点。進み具合に合わせて西から灯る */}
        {DOTS.map((dot, i) => (
          <circle
            key={i}
            cx={dot.x}
            cy={dot.y}
            r={3.2}
            className={`map-loading-dot${i < litCount ? " is-lit" : ""}`}
          />
        ))}

        {/* 高知城（西端） */}
        <g transform={`translate(${WEST_END.x - 7} ${WEST_END.y - 24})`} stroke="#a16207" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M2 14 L2 6 L7 2 L12 6 L12 14 Z" fill="#fff7e6" />
          <path d="M0 8 L14 8" />
        </g>
        <text
          x={WEST_END.x}
          y={WEST_END.y + 26}
          textAnchor="middle"
          fontSize="9"
          fill="#92400e"
          fontWeight="600"
          style={{ letterSpacing: "0.08em" }}
        >
          高知城
        </text>
        <text
          x={EAST_END.x}
          y={EAST_END.y + 26}
          textAnchor="middle"
          fontSize="9"
          fill="#a16207"
          fillOpacity="0.8"
          style={{ letterSpacing: "0.08em" }}
        >
          東へ
        </text>

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
    </div>
  );
}
