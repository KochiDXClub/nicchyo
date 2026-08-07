'use client';

/**
 * FacilityLayer
 *
 * 「おでかけサポート」で選んだカテゴリの施設を、マップ上に強調表示する。
 * MapCharacterConsult と同じく Leaflet のインスタンスを受け取り、
 * マーカーとルート線を命令的に出し入れする。
 *
 * - 選択中カテゴリの施設だけを表示（＝そのカテゴリが目立つ）
 * - 一番近い施設はひとまわり大きく、脈打つ強調表示にする
 * - 現在地があれば、そこから最寄り施設まで破線でルートの目安を引く
 */

import { useEffect } from 'react';
import L, { type Map as LeafletMap } from 'leaflet';
import type { Facility, FacilityCategory } from '@/lib/facilities/facilities';
import type { LatLng } from '@/lib/facilities/nearest';

type FacilityLayerProps = {
  map: LeafletMap | null;
  category: FacilityCategory;
  facilities: Facility[];
  /** 最寄り施設のID。無い場合は全マーカーが同じ見た目になる */
  nearestFacilityId?: string | null;
  /** 現在地から最寄り施設までの道すじ（通り沿い）。2点未満なら描かない */
  routePoints?: LatLng[];
  userLocation?: LatLng | null;
  onSelectFacility?: (facility: Facility) => void;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function buildMarkerHtml(
  facility: Facility,
  category: FacilityCategory,
  isNearest: boolean
): string {
  const size = isNearest ? 52 : 40;
  const fontSize = isNearest ? 26 : 20;

  return `
    <div class="facility-marker ${isNearest ? 'facility-marker--nearest' : ''}">
      <div class="facility-marker__pin" style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${category.markerColor};
        font-size: ${fontSize}px;
      ">${category.emoji}</div>
      <div class="facility-marker__label">${escapeHtml(facility.name)}</div>
    </div>
  `;
}

export default function FacilityLayer({
  map,
  category,
  facilities,
  nearestFacilityId,
  routePoints,
  userLocation,
  onSelectFacility,
}: FacilityLayerProps) {
  useEffect(() => {
    if (!map || facilities.length === 0) return;

    const layerGroup = L.layerGroup().addTo(map);

    facilities.forEach((facility) => {
      const isNearest = facility.id === nearestFacilityId;
      const size = isNearest ? 52 : 40;

      const marker = L.marker([facility.lat, facility.lng], {
        icon: L.divIcon({
          html: buildMarkerHtml(facility, category, isNearest),
          className: 'facility-marker-container',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        // 店舗マーカー（zIndexOffset なし）より前面、現在地（1000）より背面
        zIndexOffset: isNearest ? 800 : 600,
        keyboard: false,
      });

      if (onSelectFacility) {
        marker.on('click', () => onSelectFacility(facility));
      }

      marker.addTo(layerGroup);
    });

    // 現在地 → 最寄り施設の道すじ。通り沿いに折れ線で描く
    if (routePoints && routePoints.length >= 2) {
      const latLngs = routePoints.map((point) => [point.lat, point.lng] as [number, number]);

      // 下に太い白線を敷いて、地図の上でも道すじが追いやすいようにする
      L.polyline(latLngs, {
        color: '#ffffff',
        weight: 9,
        opacity: 0.9,
        interactive: false,
      }).addTo(layerGroup);

      L.polyline(latLngs, {
        color: category.markerColor,
        weight: 5,
        opacity: 0.95,
        dashArray: '12 9',
        interactive: false,
      }).addTo(layerGroup);
    }

    return () => {
      layerGroup.clearLayers();
      map.removeLayer(layerGroup);
    };
  }, [category, facilities, map, nearestFacilityId, onSelectFacility, routePoints]);

  // 画角を寄せる。
  // マップシェルには CSS の回転がかかっており fitBounds の padding が
  // 見た目どおりに効かないため、中心とズームを直接指定する。
  const hasUserLocation = Boolean(userLocation);
  useEffect(() => {
    if (!map || facilities.length === 0) return;

    const nearest = facilities.find((facility) => facility.id === nearestFacilityId);

    // 現在地と最寄り施設の両方が分かるなら、その中間を映して道のりを見せる
    const center: [number, number] =
      userLocation && nearest
        ? [(userLocation.lat + nearest.lat) / 2, (userLocation.lng + nearest.lng) / 2]
        : [
            facilities.reduce((sum, f) => sum + f.lat, 0) / facilities.length,
            facilities.reduce((sum, f) => sum + f.lng, 0) / facilities.length,
          ];

    const zoom = userLocation && nearest ? 17 : 16;
    map.setView(center, zoom, { animate: true, duration: 0.6 });
    // カテゴリの切り替え時と、現在地が取れた最初の1回だけ寄せる。
    // 現在地の更新のたびに動かすと地図操作の邪魔になるため userLocation 自体は依存に含めない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id, hasUserLocation, map]);

  return null;
}
