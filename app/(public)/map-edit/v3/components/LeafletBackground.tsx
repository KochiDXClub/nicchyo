"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const BASEMAP_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
const BASEMAP_ATTRIBUTION =
  '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** SVG側の「1メートルあたり何px」というズームを、おおよそ対応するLeafletズームレベルに変換する */
function toLeafletZoom(pixelsPerMeter: number, lat: number): number {
  const metersPerPixelAtZoom0 = 156543.03392 * Math.cos((lat * Math.PI) / 180);
  const z = Math.log2(metersPerPixelAtZoom0 / (1 / pixelsPerMeter));
  return Math.min(19, Math.max(3, z));
}

function ViewSync({ center, pixelsPerMeter }: { center: { lat: number; lng: number }; pixelsPerMeter: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], toLeafletZoom(pixelsPerMeter, center.lat), { animate: false });
  }, [map, center.lat, center.lng, pixelsPerMeter]);
  return null;
}

/**
 * SVGキャンバスの下にうっすら表示する背景用のLeafletマップ。
 * 実際の地図と照らし合わせながら区画・道を編集しやすくするための目安表示であり、
 * 操作はすべてSVG側（自前のpan/zoom）で行うため、Leaflet自体の操作は無効化する。
 */
export default function LeafletBackground({
  center,
  pixelsPerMeter,
}: {
  center: { lat: number; lng: number };
  pixelsPerMeter: number;
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={17}
      zoomControl={false}
      attributionControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      // タイルのフェードイン・ズーム時のアニメーションを止め、SVG側のpan/zoomと
      // 常に即座に一致させる（アニメーションが残っていると、SVG側の建物・区画は
      // 即座に動くのに背景タイルだけ遅れて追いつくように見え、位置がズレて見える）
      fadeAnimation={false}
      zoomAnimation={false}
      markerZoomAnimation={false}
      inertia={false}
      style={{ position: "absolute", inset: 0 }}
    >
      <TileLayer
        url={BASEMAP_TILE_URL}
        attribution={BASEMAP_ATTRIBUTION}
        opacity={0.35}
        // 編集対象のエリアは日曜市の一区画のみとごく狭いため、周囲のタイルを
        // 多めに先読み・保持しておき、panしても読み込み待ちで背景が遅れないようにする
        keepBuffer={24}
        updateWhenZooming={false}
      />
      <ViewSync center={center} pixelsPerMeter={pixelsPerMeter} />
    </MapContainer>
  );
}
