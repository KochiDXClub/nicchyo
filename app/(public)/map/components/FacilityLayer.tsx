'use client';

/**
 * FacilityLayer
 *
 * 「おでかけサポート」で選んだカテゴリの施設を、マップ上に強調表示する。
 * MapCharacterConsult と同じくマップのカメラ（MapCamera）を受け取り、
 * マーカーとルート線を命令的に出し入れする。
 *
 * - 選択中カテゴリの施設だけを表示（＝そのカテゴリが目立つ）
 * - 一番近い施設はひとまわり大きく、脈打つ強調表示にする
 * - 現在地があれば、そこから最寄り施設まで破線でルートの目安を引く
 *
 * Leaflet 版は L.marker / L.polyline、MapLibre 版は HTML マーカー（maplibregl.Marker）と
 * GeoJSON の line レイヤーで同じ見た目を作る。マーカーの HTML と CSS は両方で共通。
 * 地図ライブラリ本体はどちらも SSR で評価しないよう、使うときに動的 import する。
 */

import { useEffect } from 'react';
import type { Map as LeafletMapType } from 'leaflet';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import type { Facility, FacilityCategory } from '@/lib/facilities/facilities';
import type { LatLng } from '@/lib/facilities/nearest';
import { getMapLibreMap, isLeafletMap, type MapCamera } from '../types/mapCamera';

type FacilityLayerProps = {
  map: MapCamera | null;
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

  // のりもの等、施設ごとの専用アイコン（電停＝オレンジ、JR＝青のSVGバッジ）が
  // あればそれを使う。アイコンは既に丸型バッジとして完結しているため、
  // カテゴリ色の背景円は重ねず、影だけ付けて視認性を確保する。
  if (facility.iconUrl) {
    return `
      <div class="facility-marker ${isNearest ? 'facility-marker--nearest' : ''}">
        <div class="facility-marker__pin facility-marker__pin--icon" style="width: ${size}px; height: ${size}px;">
          <img src="${facility.iconUrl}" alt="" width="${size}" height="${size}" draggable="false" />
        </div>
        <div class="facility-marker__label">${escapeHtml(facility.name)}</div>
      </div>
    `;
  }

  return `
    <div class="facility-marker ${isNearest ? 'facility-marker--nearest' : ''}">
      <div class="facility-marker__pin" style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${facility.markerColor ?? category.markerColor};
        font-size: ${fontSize}px;
      ">${category.emoji}</div>
      <div class="facility-marker__label">${escapeHtml(facility.name)}</div>
    </div>
  `;
}

/** ルート線の見た目（Leaflet / MapLibre 共通） */
const ROUTE_CASING = { color: '#ffffff', weight: 9, opacity: 0.9 };
const ROUTE_LINE = { weight: 5, opacity: 0.95, dash: [12, 9] as [number, number] };

type LeafletModule = typeof import('leaflet');

/** Leaflet 版：マーカーと折れ線を layerGroup にまとめて載せる */
function mountLeaflet(
  L: LeafletModule,
  map: LeafletMapType,
  props: Pick<FacilityLayerProps, 'category' | 'facilities' | 'nearestFacilityId' | 'routePoints' | 'onSelectFacility'>
): () => void {
  const { category, facilities, nearestFacilityId, routePoints, onSelectFacility } = props;
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
    const nearest = facilities.find((facility) => facility.id === nearestFacilityId);
    const routeColor = nearest?.markerColor ?? category.markerColor;

    // 下に太い白線を敷いて、地図の上でも道すじが追いやすいようにする
    L.polyline(latLngs, { ...ROUTE_CASING, interactive: false }).addTo(layerGroup);

    L.polyline(latLngs, {
      color: routeColor,
      weight: ROUTE_LINE.weight,
      opacity: ROUTE_LINE.opacity,
      dashArray: ROUTE_LINE.dash.join(' '),
      interactive: false,
    }).addTo(layerGroup);
  }

  return () => {
    layerGroup.clearLayers();
    map.removeLayer(layerGroup);
  };
}

const MAPLIBRE_ROUTE_SOURCE = 'nicchyo-facility-route';
const MAPLIBRE_ROUTE_CASING_LAYER = 'nicchyo-facility-route-casing';
const MAPLIBRE_ROUTE_LAYER = 'nicchyo-facility-route-line';
/** ルート線をこのレイヤーの下（＝道の上、屋台の下）に差し込む */
const MAPLIBRE_ROUTE_BEFORE_LAYER = 'nicchyo-shops';

/**
 * MapLibre 版：HTML マーカー（maplibregl.Marker）と GeoJSON の line レイヤー。
 * maplibre-gl 本体は Leaflet 版のバンドルに混ぜないよう、必要になったときだけ読み込む。
 */
function mountMapLibre(
  map: MapLibreMap,
  props: Pick<FacilityLayerProps, 'category' | 'facilities' | 'nearestFacilityId' | 'routePoints' | 'onSelectFacility'>
): () => void {
  const { category, facilities, nearestFacilityId, routePoints, onSelectFacility } = props;
  let disposed = false;
  const markers: MapLibreMarker[] = [];

  void import('maplibre-gl').then(({ default: maplibregl }) => {
    if (disposed) return;
    facilities.forEach((facility) => {
      const isNearest = facility.id === nearestFacilityId;
      const el = document.createElement('div');
      el.className = 'facility-marker-container';
      el.innerHTML = buildMarkerHtml(facility, category, isNearest);
      // 最寄りは他の施設より前面に
      el.style.zIndex = isNearest ? '2' : '1';
      if (onSelectFacility) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          onSelectFacility(facility);
        });
      }
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([facility.lng, facility.lat])
        .addTo(map);
      markers.push(marker);
    });
  });

  const hasRoute = Boolean(routePoints && routePoints.length >= 2);
  if (hasRoute && routePoints) {
    const nearest = facilities.find((facility) => facility.id === nearestFacilityId);
    const routeColor = nearest?.markerColor ?? category.markerColor;
    const beforeId = map.getLayer(MAPLIBRE_ROUTE_BEFORE_LAYER) ? MAPLIBRE_ROUTE_BEFORE_LAYER : undefined;

    map.addSource(MAPLIBRE_ROUTE_SOURCE, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routePoints.map((point) => [point.lng, point.lat]),
        },
      },
    });
    map.addLayer(
      {
        id: MAPLIBRE_ROUTE_CASING_LAYER,
        type: 'line',
        source: MAPLIBRE_ROUTE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ROUTE_CASING.color,
          'line-width': ROUTE_CASING.weight,
          'line-opacity': ROUTE_CASING.opacity,
        },
      },
      beforeId
    );
    map.addLayer(
      {
        id: MAPLIBRE_ROUTE_LAYER,
        type: 'line',
        source: MAPLIBRE_ROUTE_SOURCE,
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': routeColor,
          'line-width': ROUTE_LINE.weight,
          'line-opacity': ROUTE_LINE.opacity,
          // MapLibre の dasharray は線幅の倍数なので、ピクセル値を線幅で割る
          'line-dasharray': [ROUTE_LINE.dash[0] / ROUTE_LINE.weight, ROUTE_LINE.dash[1] / ROUTE_LINE.weight],
        },
      },
      beforeId
    );
  }

  return () => {
    disposed = true;
    for (const marker of markers) marker.remove();
    markers.length = 0;
    // マップ破棄後（map.remove 済み）の後片付けでは何もしない
    if (!map.getStyle()) return;
    if (map.getLayer(MAPLIBRE_ROUTE_LAYER)) map.removeLayer(MAPLIBRE_ROUTE_LAYER);
    if (map.getLayer(MAPLIBRE_ROUTE_CASING_LAYER)) map.removeLayer(MAPLIBRE_ROUTE_CASING_LAYER);
    if (map.getSource(MAPLIBRE_ROUTE_SOURCE)) map.removeSource(MAPLIBRE_ROUTE_SOURCE);
  };
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
    const props = { category, facilities, nearestFacilityId, routePoints, onSelectFacility };

    if (isLeafletMap(map)) {
      // leaflet は window を参照するため SSR では読み込まず、ここで初めて読み込む
      let disposed = false;
      let unmount: (() => void) | null = null;
      void import('leaflet').then((mod) => {
        if (disposed) return;
        unmount = mountLeaflet(mod.default, map as unknown as LeafletMapType, props);
      });
      return () => {
        disposed = true;
        unmount?.();
      };
    }
    const maplibreMap = getMapLibreMap(map);
    if (maplibreMap) {
      return mountMapLibre(maplibreMap, props);
    }
    return undefined;
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
