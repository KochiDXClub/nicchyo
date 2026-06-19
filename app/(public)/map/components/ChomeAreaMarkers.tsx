'use client';

/**
 * 縮小表示（zoom < 17）時に各丁目の中心に表示するエリアマーカー。
 * leaflet.markercluster の代替として、世界観を維持しつつ
 * 「日曜市は7丁目構成」であることを直感的に伝える。
 *
 * クリックすると該当丁目へ flyTo（DETAIL モード相当の zoom 20）。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Shop } from '../data/shops';

// ── 丁目ごとの漢字ラベル ──────────────────────────────
const CHOME_KANJI: Record<string, string> = {
  '一丁目': '一',
  '二丁目': '二',
  '三丁目': '三',
  '四丁目': '四',
  '五丁目': '五',
  '六丁目': '六',
  '七丁目': '七',
};

const CHOME_ORDER = [
  '一丁目', '二丁目', '三丁目', '四丁目', '五丁目', '六丁目', '七丁目',
] as const;

// ── chome データがない場合の道路セグメント中心座標（D1〜D7）──
const SEGMENT_FALLBACK: Record<string, [number, number]> = {
  '一丁目': [33.5620906, 133.5406533],
  '二丁目': [33.5618643, 133.5395802],
  '三丁目': [33.5616381, 133.5385072],
  '四丁目': [33.5614118, 133.5374341],
  '五丁目': [33.5611855, 133.5363610],
  '六丁目': [33.5609593, 133.5352879],
  '七丁目': [33.5607330, 133.5342149],
};

type ChomeData = {
  chome: string;
  lat: number;
  lng: number;
  count: number;
};

// ── 店舗データから丁目ごとの重心・店舗数を計算 ──────────
function computeChomeCentroids(shops: Shop[]): ChomeData[] {
  const groups = new Map<string, { lats: number[]; lngs: number[] }>();

  shops.forEach((shop) => {
    if (!shop.chome) return;
    const g = groups.get(shop.chome);
    if (g) {
      g.lats.push(shop.lat);
      g.lngs.push(shop.lng);
    } else {
      groups.set(shop.chome, { lats: [shop.lat], lngs: [shop.lng] });
    }
  });

  // chome データが全くない場合はセグメント座標でフォールバック
  const hasChomeData = groups.size > 0;

  return CHOME_ORDER.map((chome) => {
    if (hasChomeData && groups.has(chome)) {
      const { lats, lngs } = groups.get(chome)!;
      const lat = lats.reduce((s, v) => s + v, 0) / lats.length;
      const lng = lngs.reduce((s, v) => s + v, 0) / lngs.length;
      return { chome, lat, lng, count: lats.length };
    }
    // フォールバック: 道路セグメント中心 + 店舗数0
    const [lat, lng] = SEGMENT_FALLBACK[chome]!;
    return { chome, lat, lng, count: 0 };
  });
}

// ── Leaflet DivIcon を生成 ───────────────────────────────
function createChomeBadgeIcon(chome: string, count: number): L.DivIcon {
  const kanji = CHOME_KANJI[chome] ?? '?';
  const countLabel = count > 0 ? `${count}店舗` : '';

  const html = `
    <div class="chome-area-badge">
      <div class="chome-area-kanji">${kanji}</div>
      <div class="chome-area-sublabel">丁目</div>
      ${countLabel ? `<div class="chome-area-count">${countLabel}</div>` : ''}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'chome-area-marker-icon',
    iconSize: [72, 82],
    iconAnchor: [36, 41],
  });
}

// ── コンポーネント ─────────────────────────────────────
type Props = {
  shops: Shop[];
  pane?: string;
};

export default function ChomeAreaMarkers({ shops, pane }: Props) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [toastLabel, setToastLabel] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const centroids = useMemo(() => computeChomeCentroids(shops), [shops]);

  useEffect(() => {
    const group = L.layerGroup();
    layerRef.current = group;

    centroids.forEach(({ chome, lat, lng, count }) => {
      const icon = createChomeBadgeIcon(chome, count);
      const marker = L.marker([lat, lng], { icon, interactive: true, pane });

      marker.on('click', () => {
        map.flyTo([lat, lng], map.getMaxZoom(), {
          animate: true,
          duration: 0.9,
          easeLinearity: 0.25,
        });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToastLabel(chome);
        toastTimer.current = setTimeout(() => setToastLabel(null), 2500);
      });

      group.addLayer(marker);
    });

    map.addLayer(group);

    return () => {
      map.removeLayer(group);
      layerRef.current = null;
    };
  }, [map, centroids]);

  if (!toastLabel) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-[2500] -translate-x-1/2 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-2 rounded-2xl bg-slate-900/88 px-4 py-2.5 shadow-xl backdrop-blur-sm">
        <span className="text-base">🗺️</span>
        <span className="text-sm font-semibold text-white">{toastLabel}のお店を表示します</span>
      </div>
    </div>
  );
}
