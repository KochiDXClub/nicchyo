"use client";

import { CHOMES, type ChomeId } from "@/lib/map/chomes";

/** 地図に出す点（場所）。位置が無い場所は点にしない */
export type IntentionMapPoint = {
  id: string;
  label: string;
  chome: ChomeId | null;
  lat: number | null;
  lng: number | null;
  /** 運営の集計で使う件数（点の大きさに使う）。出店者の画面では使わない */
  count?: number | null;
};

type Props = {
  points: IntentionMapPoint[];
  /** 選ばれている場所 */
  selectedId: string | null;
  /** この丁目だけ選べる（ほかの丁目の点は薄く出して、押せなくする）。null なら全部選べる */
  activeChome: ChomeId | null;
  /** 点を押したとき（押せる点だけ呼ばれる） */
  onSelect?: (point: IntentionMapPoint) => void;
  /** 読み上げ用の説明 */
  label: string;
};

const WIDTH = 360;
const HEIGHT = 280;
const PADDING = 16;

/**
 * 出店場所（区画の点）を、位置どおりに並べた図。背景の道や店は描かない（点の並びだけを示す）。
 * 点はキーボードでも選べる。色は丁目ごとの色（lib/map/chomes の color）。
 */
export default function IntentionPointMap({ points, selectedId, activeChome, onSelect, label }: Props) {
  const located = points.filter((point): point is IntentionMapPoint & { lat: number; lng: number } => point.lat !== null && point.lng !== null);
  if (located.length === 0) {
    return <p className="text-sm text-nicchyo-ink/70">地図に出せる場所がまだありません。</p>;
  }

  const lats = located.map((p) => p.lat);
  const lngs = located.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  // 経度は緯度の余弦で縮めて、縦横の比を合わせる（高知では約 0.84）
  const cos = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = Math.max((maxLng - minLng) * cos, 1e-9);
  const spanY = Math.max(maxLat - minLat, 1e-9);
  const scale = Math.min((WIDTH - PADDING * 2) / spanX, (HEIGHT - PADDING * 2) / spanY);
  const project = (lat: number, lng: number) => ({
    x: PADDING + (lng - minLng) * cos * scale,
    y: HEIGHT - PADDING - (lat - minLat) * scale,
  });

  const maxCount = Math.max(1, ...located.map((p) => p.count ?? 0));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={label} className="block h-auto w-full rounded-btn bg-nicchyo-base ring-1 ring-nicchyo-ink/15">
      {located.map((point) => {
        const { x, y } = project(point.lat, point.lng);
        // 丁目の色（lib/map/chomes）。丁目が分からない点は、トークンの淡い緑で出す
        const chomeColor = CHOMES.find((chome) => chome.id === point.chome)?.color ?? null;
        const selectable = onSelect !== undefined && (activeChome === null || point.chome === activeChome);
        const selected = point.id === selectedId;
        // 運営の集計では件数で点を大きくする（件数が無いときは標準の大きさ）
        const radius = point.count === undefined || point.count === null ? 6 : 5 + (point.count / maxCount) * 7;
        const dimmed = !selectable && onSelect !== undefined;
        return (
          <g key={point.id} opacity={dimmed ? 0.3 : 1}>
            <circle
              cx={x}
              cy={y}
              r={selected ? radius + 2 : radius}
              className={`${chomeColor ? "" : "fill-nicchyo-soft-green"} ${selected ? "stroke-nicchyo-ink" : "stroke-nicchyo-base"}`}
              strokeWidth={selected ? 3 : 1.5}
              role={selectable ? "button" : undefined}
              tabIndex={selectable ? 0 : undefined}
              aria-label={point.label}
              aria-pressed={selectable ? selected : undefined}
              style={{ fill: chomeColor ?? undefined, cursor: selectable ? "pointer" : "default" }}
              onClick={selectable ? () => onSelect?.(point) : undefined}
              onKeyDown={
                selectable
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect?.(point);
                      }
                    }
                  : undefined
              }
            >
              <title>{point.label}</title>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}
