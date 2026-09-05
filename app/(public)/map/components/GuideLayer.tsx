'use client';

/**
 * GuideLayer
 *
 * おでかけサポートで案内中のスポットと経路をマップに描く。
 * （旧 FacilityLayer を、統一スポット（MapSpot）と複数経路に対応させたもの）
 *
 * - 表示中の種別のスポットをマーカーで出す。選択中はひとまわり大きく脈打つ
 * - 経路は複数描ける。上位数件は薄く、選択中は濃い破線
 *
 * Leaflet 版は L.marker / L.polyline、MapLibre 版は HTML マーカー（maplibregl.Marker）と
 * GeoJSON の line レイヤーで同じ見た目を作る。マーカーの HTML と CSS は両方で共通。
 * 地図ライブラリ本体はどちらも SSR で評価しないよう、使うときに動的 import する。
 */

import { useEffect } from 'react';
import type { Map as LeafletMapType } from 'leaflet';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
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

type LeafletModule = typeof import('leaflet');
type MountProps = Pick<GuideLayerProps, 'spots' | 'selectedSpotId' | 'routes' | 'onSelectSpot'>;

function mountLeaflet(L: LeafletModule, map: LeafletMapType, props: MountProps): () => void {
  const { spots, selectedSpotId, routes, onSelectSpot } = props;
  const layerGroup = L.layerGroup().addTo(map);

  // 薄い線 → 濃い線の順に重ねる
  for (const route of [...routes].sort((a) => (a.emphasis === 'faint' ? -1 : 1))) {
    if (route.points.length < 2) continue;
    const latLngs = route.points.map((p) => [p.lat, p.lng] as [number, number]);
    const style = route.emphasis === 'strong' ? ROUTE_STRONG : ROUTE_FAINT;
    if (route.emphasis === 'strong') {
      L.polyline(latLngs, { ...ROUTE_CASING, interactive: false }).addTo(layerGroup);
    }
    L.polyline(latLngs, {
      color: route.color,
      weight: style.weight,
      opacity: style.opacity,
      dashArray: style.dash.join(' '),
      interactive: false,
    }).addTo(layerGroup);
  }

  spots.forEach((spot) => {
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
    marker.addTo(layerGroup);
  });

  return () => {
    layerGroup.clearLayers();
    map.removeLayer(layerGroup);
  };
}

const MAPLIBRE_SOURCE_PREFIX = 'nicchyo-guide-route-';
/** ルート線をこのレイヤーの下（＝道の上、屋台の下）に差し込む */
const MAPLIBRE_ROUTE_BEFORE_LAYER = 'nicchyo-shops';

function mountMapLibre(map: MapLibreMap, props: MountProps): () => void {
  const { spots, selectedSpotId, routes, onSelectSpot } = props;
  let disposed = false;
  const markers: MapLibreMarker[] = [];
  const layerIds: string[] = [];
  const sourceIds: string[] = [];

  void import('maplibre-gl').then(({ default: maplibregl }) => {
    if (disposed) return;
    spots.forEach((spot) => {
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
      markers.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([spot.lng, spot.lat]).addTo(map));
    });
  });

  const beforeId = map.getLayer(MAPLIBRE_ROUTE_BEFORE_LAYER) ? MAPLIBRE_ROUTE_BEFORE_LAYER : undefined;
  for (const route of [...routes].sort((a) => (a.emphasis === 'faint' ? -1 : 1))) {
    if (route.points.length < 2) continue;
    const sourceId = `${MAPLIBRE_SOURCE_PREFIX}${route.id}`;
    if (map.getSource(sourceId)) continue;
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: route.points.map((p) => [p.lng, p.lat]) },
      },
    });
    sourceIds.push(sourceId);
    const style = route.emphasis === 'strong' ? ROUTE_STRONG : ROUTE_FAINT;
    if (route.emphasis === 'strong') {
      const casingId = `${sourceId}-casing`;
      map.addLayer(
        {
          id: casingId,
          type: 'line',
          source: sourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ROUTE_CASING.color, 'line-width': ROUTE_CASING.weight, 'line-opacity': ROUTE_CASING.opacity },
        },
        beforeId
      );
      layerIds.push(casingId);
    }
    const lineId = `${sourceId}-line`;
    map.addLayer(
      {
        id: lineId,
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
    layerIds.push(lineId);
  }

  return () => {
    disposed = true;
    for (const marker of markers) marker.remove();
    markers.length = 0;
    // マップ破棄後（map.remove 済み）の後片付けでは何もしない
    if (!map.getStyle()) return;
    for (const id of layerIds) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of sourceIds) if (map.getSource(id)) map.removeSource(id);
  };
}

export default function GuideLayer({ map, spots, selectedSpotId, routes, onSelectSpot }: GuideLayerProps) {
  useEffect(() => {
    if (!map || (spots.length === 0 && routes.length === 0)) return;
    const props: MountProps = { spots, selectedSpotId, routes, onSelectSpot };

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
    if (maplibreMap) return mountMapLibre(maplibreMap, props);
    return undefined;
  }, [map, onSelectSpot, routes, selectedSpotId, spots]);

  return null;
}
