'use client';

/**
 * GuideLayer
 *
 * おでかけサポートで案内中のスポットと経路をマップに描く。
 *
 * - 表示中の種類のスポットをマーカーで出す。選択中はひとまわり大きく脈打つ
 * - 経路は複数描ける。上位数件は薄く、選択中は濃い破線
 *
 * マーカーと経路線は別々に管理し、変わったものだけを差し替える
 * （毎回すべて消して描き直すと、地図を動かすたびに点滅して見える）。
 * 経路線は同じ id の線が残っていれば座標だけ更新する。
 *
 * Leaflet 版は L.marker / L.polyline、MapLibre 版は HTML マーカー（maplibregl.Marker）と
 * GeoJSON の line レイヤーで同じ見た目を作る。地図ライブラリ本体はどちらも SSR で
 * 評価しないよう、使うときに動的 import する。
 */

import { useEffect, useRef } from 'react';
import type { Map as LeafletMapType, LayerGroup, Polyline } from 'leaflet';
import type { Map as MapLibreMap, Marker as MapLibreMarker, GeoJSONSource } from 'maplibre-gl';
import type { MapSpot } from '@/lib/spots';
import type { LatLng } from '@/lib/facilities/geo';
import { getMapLibreMap, isLeafletMap, type MapCamera } from '../types/mapCamera';

export type GuideRouteLine = {
  id: string;
  points: LatLng[];
  color: string;
  emphasis: 'faint' | 'strong';
};

type GuideLayerProps = {
  map: MapCamera | null;
  spots: MapSpot[];
  selectedSpotId?: string | null;
  routes: GuideRouteLine[];
  onSelectSpot?: (spot: MapSpot) => void;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function buildMarkerHtml(spot: MapSpot, isSelected: boolean): string {
  const size = isSelected ? 52 : 40;
  const fontSize = isSelected ? 26 : 20;
  const stateClass = isSelected ? 'facility-marker--nearest' : '';

  if (spot.iconUrl) {
    return `
      <div class="facility-marker ${stateClass}">
        <div class="facility-marker__pin facility-marker__pin--icon" style="width: ${size}px; height: ${size}px;">
          <img src="${spot.iconUrl}" alt="" width="${size}" height="${size}" draggable="false" />
        </div>
        <div class="facility-marker__label">${escapeHtml(spot.name)}</div>
      </div>
    `;
  }
  return `
    <div class="facility-marker ${stateClass}">
      <div class="facility-marker__pin" style="width: ${size}px; height: ${size}px; background-color: ${spot.accentColor}; font-size: ${fontSize}px;">${spot.emoji ?? '📍'}</div>
      <div class="facility-marker__label">${escapeHtml(spot.name)}</div>
    </div>
  `;
}

/** ルート線の見た目（Leaflet / MapLibre 共通） */
const ROUTE_CASING = { color: '#ffffff', weight: 9, opacity: 0.9 };
const ROUTE_STRONG = { weight: 5, opacity: 0.95, dash: [12, 9] as [number, number] };
const ROUTE_FAINT = { weight: 3, opacity: 0.45, dash: [6, 8] as [number, number] };

const routeStyleKey = (route: GuideRouteLine) => `${route.color}:${route.emphasis}`;

/* ───────────────────────── Leaflet ───────────────────────── */

type LeafletModule = typeof import('leaflet');

type LeafletState = {
  L: LeafletModule;
  map: LeafletMapType;
  markerGroup: LayerGroup;
  routeGroup: LayerGroup;
  /** 経路 id → 線（色・強調が変わったら作り直す） */
  routeLines: Map<string, { styleKey: string; casing: Polyline | null; line: Polyline }>;
};

function leafletSyncMarkers(state: LeafletState, spots: MapSpot[], selectedSpotId: string | null | undefined, onSelectSpot?: (spot: MapSpot) => void) {
  const { L, markerGroup } = state;
  markerGroup.clearLayers();
  for (const spot of spots) {
    const isSelected = spot.id === selectedSpotId;
    const size = isSelected ? 52 : 40;
    const marker = L.marker([spot.lat, spot.lng], {
      icon: L.divIcon({
        html: buildMarkerHtml(spot, isSelected),
        className: 'facility-marker-container',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      }),
      // 店舗マーカー（zIndexOffset なし）より前面、現在地（1000）より背面
      zIndexOffset: isSelected ? 800 : 600,
      keyboard: false,
    });
    if (onSelectSpot) marker.on('click', () => onSelectSpot(spot));
    marker.addTo(markerGroup);
  }
}

function leafletSyncRoutes(state: LeafletState, routes: GuideRouteLine[]) {
  const { L, routeGroup, routeLines } = state;
  const wanted = new Set(routes.map((r) => r.id));
  // 不要になった線を消す
  for (const [id, entry] of routeLines) {
    if (wanted.has(id)) continue;
    entry.casing?.remove();
    entry.line.remove();
    routeLines.delete(id);
  }
  // 薄い線 → 濃い線の順（濃い線が上に来る）
  for (const route of [...routes].sort((a, b) => Number(a.emphasis === 'strong') - Number(b.emphasis === 'strong'))) {
    if (route.points.length < 2) continue;
    const latLngs = route.points.map((p) => [p.lat, p.lng] as [number, number]);
    const styleKey = routeStyleKey(route);
    const existing = routeLines.get(route.id);
    if (existing && existing.styleKey === styleKey) {
      existing.casing?.setLatLngs(latLngs);
      existing.line.setLatLngs(latLngs);
      existing.casing?.bringToFront();
      existing.line.bringToFront();
      continue;
    }
    existing?.casing?.remove();
    existing?.line.remove();
    const style = route.emphasis === 'strong' ? ROUTE_STRONG : ROUTE_FAINT;
    const casing =
      route.emphasis === 'strong' ? L.polyline(latLngs, { ...ROUTE_CASING, interactive: false }).addTo(routeGroup) : null;
    const line = L.polyline(latLngs, {
      color: route.color,
      weight: style.weight,
      opacity: style.opacity,
      dashArray: style.dash.join(' '),
      interactive: false,
    }).addTo(routeGroup);
    routeLines.set(route.id, { styleKey, casing, line });
  }
}

/* ───────────────────────── MapLibre ───────────────────────── */

const MAPLIBRE_SOURCE_PREFIX = 'nicchyo-guide-route-';
/** ルート線をこのレイヤーの下（＝道の上、屋台の下）に差し込む */
const MAPLIBRE_ROUTE_BEFORE_LAYER = 'nicchyo-shops';

type MapLibreState = {
  map: MapLibreMap;
  maplibregl: typeof import('maplibre-gl') | null;
  markers: MapLibreMarker[];
  /** 経路 id → 見た目のキー（変わったらレイヤーを作り直す） */
  routeStyles: Map<string, string>;
  pendingSpots: { spots: MapSpot[]; selectedSpotId: string | null | undefined; onSelectSpot?: (spot: MapSpot) => void } | null;
};

function maplibreSyncMarkers(state: MapLibreState, spots: MapSpot[], selectedSpotId: string | null | undefined, onSelectSpot?: (spot: MapSpot) => void) {
  if (!state.maplibregl) {
    // ライブラリ読み込み待ち。読み込み後に最新の内容で描く
    state.pendingSpots = { spots, selectedSpotId, onSelectSpot };
    return;
  }
  const { maplibregl, map } = state;
  for (const marker of state.markers) marker.remove();
  state.markers = [];
  for (const spot of spots) {
    const isSelected = spot.id === selectedSpotId;
    const el = document.createElement('div');
    el.className = 'facility-marker-container';
    el.innerHTML = buildMarkerHtml(spot, isSelected);
    el.style.zIndex = isSelected ? '2' : '1';
    if (onSelectSpot) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        onSelectSpot(spot);
      });
    }
    state.markers.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([spot.lng, spot.lat]).addTo(map));
  }
}

function lineFeature(route: GuideRouteLine): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: route.points.map((p) => [p.lng, p.lat]) },
  };
}

function maplibreRemoveRoute(map: MapLibreMap, id: string) {
  const sourceId = `${MAPLIBRE_SOURCE_PREFIX}${id}`;
  for (const layerId of [`${sourceId}-casing`, `${sourceId}-line`]) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

function maplibreSyncRoutes(state: MapLibreState, routes: GuideRouteLine[]) {
  const { map, routeStyles } = state;
  if (!map.getStyle()) return;
  const wanted = new Set(routes.map((r) => r.id));
  for (const id of Array.from(routeStyles.keys())) {
    if (wanted.has(id)) continue;
    maplibreRemoveRoute(map, id);
    routeStyles.delete(id);
  }
  const beforeId = map.getLayer(MAPLIBRE_ROUTE_BEFORE_LAYER) ? MAPLIBRE_ROUTE_BEFORE_LAYER : undefined;
  for (const route of [...routes].sort((a, b) => Number(a.emphasis === 'strong') - Number(b.emphasis === 'strong'))) {
    if (route.points.length < 2) continue;
    const sourceId = `${MAPLIBRE_SOURCE_PREFIX}${route.id}`;
    const styleKey = routeStyleKey(route);
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (source && routeStyles.get(route.id) === styleKey) {
      source.setData(lineFeature(route));
      continue;
    }
    if (source) maplibreRemoveRoute(map, route.id);
    map.addSource(sourceId, { type: 'geojson', data: lineFeature(route) });
    const style = route.emphasis === 'strong' ? ROUTE_STRONG : ROUTE_FAINT;
    if (route.emphasis === 'strong') {
      map.addLayer(
        {
          id: `${sourceId}-casing`,
          type: 'line',
          source: sourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ROUTE_CASING.color, 'line-width': ROUTE_CASING.weight, 'line-opacity': ROUTE_CASING.opacity },
        },
        beforeId
      );
    }
    map.addLayer(
      {
        id: `${sourceId}-line`,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': route.color,
          'line-width': style.weight,
          'line-opacity': style.opacity,
          // MapLibre の dasharray は線幅の倍数なので、ピクセル値を線幅で割る
          'line-dasharray': [style.dash[0] / style.weight, style.dash[1] / style.weight],
        },
      },
      beforeId
    );
    routeStyles.set(route.id, styleKey);
  }
}

/* ───────────────────────── React ───────────────────────── */

export default function GuideLayer({ map, spots, selectedSpotId, routes, onSelectSpot }: GuideLayerProps) {
  const leafletRef = useRef<LeafletState | null>(null);
  const maplibreRef = useRef<MapLibreState | null>(null);
  // 最新の props（ライブラリ読み込み完了時にその時点の内容で描くため）
  const latestRef = useRef({ spots, selectedSpotId, routes, onSelectSpot });
  latestRef.current = { spots, selectedSpotId, routes, onSelectSpot };

  // ── 土台（レイヤーグループ / ライブラリ）は地図ごとに1回だけ用意する ──
  useEffect(() => {
    if (!map) return;
    let disposed = false;

    if (isLeafletMap(map)) {
      void import('leaflet').then((mod) => {
        if (disposed) return;
        const L = mod.default;
        const leafletMap = map as unknown as LeafletMapType;
        const state: LeafletState = {
          L,
          map: leafletMap,
          markerGroup: L.layerGroup().addTo(leafletMap),
          routeGroup: L.layerGroup().addTo(leafletMap),
          routeLines: new Map(),
        };
        leafletRef.current = state;
        const latest = latestRef.current;
        leafletSyncRoutes(state, latest.routes);
        leafletSyncMarkers(state, latest.spots, latest.selectedSpotId, latest.onSelectSpot);
      });
      return () => {
        disposed = true;
        const state = leafletRef.current;
        leafletRef.current = null;
        if (!state) return;
        state.markerGroup.clearLayers();
        state.routeGroup.clearLayers();
        state.map.removeLayer(state.markerGroup);
        state.map.removeLayer(state.routeGroup);
      };
    }

    const maplibreMap = getMapLibreMap(map);
    if (!maplibreMap) return;
    const state: MapLibreState = { map: maplibreMap, maplibregl: null, markers: [], routeStyles: new Map(), pendingSpots: null };
    maplibreRef.current = state;
    const latest = latestRef.current;
    maplibreSyncRoutes(state, latest.routes);
    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (disposed) return;
      state.maplibregl = maplibregl;
      const pending = state.pendingSpots ?? latestRef.current;
      state.pendingSpots = null;
      maplibreSyncMarkers(state, pending.spots, pending.selectedSpotId, pending.onSelectSpot);
    });
    return () => {
      disposed = true;
      maplibreRef.current = null;
      for (const marker of state.markers) marker.remove();
      state.markers = [];
      // マップ破棄後（map.remove 済み）の後片付けでは何もしない
      if (!maplibreMap.getStyle()) return;
      for (const id of Array.from(state.routeStyles.keys())) maplibreRemoveRoute(maplibreMap, id);
      state.routeStyles.clear();
    };
  }, [map]);

  // ── マーカーは「スポット一覧・選択」が変わったときだけ ──
  useEffect(() => {
    if (leafletRef.current) leafletSyncMarkers(leafletRef.current, spots, selectedSpotId, onSelectSpot);
    if (maplibreRef.current) maplibreSyncMarkers(maplibreRef.current, spots, selectedSpotId, onSelectSpot);
  }, [spots, selectedSpotId, onSelectSpot]);

  // ── 経路線は「経路」が変わったときだけ。同じ線は座標だけ更新する ──
  useEffect(() => {
    if (leafletRef.current) leafletSyncRoutes(leafletRef.current, routes);
    if (maplibreRef.current) maplibreSyncRoutes(maplibreRef.current, routes);
  }, [routes]);

  return null;
}
