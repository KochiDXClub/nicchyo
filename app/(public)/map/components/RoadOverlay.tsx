/**
 * Road overlay component.
 */

'use client';

import { Fragment, memo, useMemo, useEffect, useState } from 'react';
import { ImageOverlay, Marker, Polygon, Polyline, Rectangle, useMap } from 'react-leaflet';
import { ROAD_CONFIG, RoadConfig } from '../config/roadConfig';
import {
  ROAD_STYLE,
  getRoadCorridorHalfWidthMeters,
  getRoadEdgeWeight,
  ROAD_LANE_DASH_ZOOM_STEP,
  getRoadLaneDashArray,
  getRoadLaneWeight,
} from '../config/roadStyle';
import L, { LatLngBoundsExpression } from 'leaflet';
import { DEFAULT_MAP_ROUTE_CONFIG } from '../types/mapRoute';
import type { MapRouteConfig, MapRoutePoint } from '../types/mapRoute';
import {
  buildRoadEdges,
  buildRoadPolygon,
  densifyPath,
  getEffectiveMapRouteConfig,
  getRouteChains,
  normalizeMapRoutePoints,
  smoothRoutePath,
  smoothPath,
} from '../utils/mapRouteGeometry';

function RoadOverlay({
  overviewTint = false,
  routePoints,
  routeConfig,
  onTap,
}: {
  overviewTint?: boolean;
  routePoints?: MapRoutePoint[];
  routeConfig?: MapRouteConfig;
  onTap?: (latlng: L.LatLng) => void;
}) {
  const config = ROAD_CONFIG;
  const latSpan = Math.abs(config.bounds[0][0] - config.bounds[1][0]);
  const lngSpan = Math.abs(config.bounds[0][1] - config.bounds[1][1]);
  const isEastWest = lngSpan > latSpan;
  const roadThickness = isEastWest ? latSpan : lngSpan;
  const separatorThickness = 0.00004;
  const roadOffset = roadThickness + separatorThickness;
  const normalizedRoutePoints = useMemo(
    () => normalizeMapRoutePoints(routePoints ?? []),
    [routePoints]
  );
  const effectiveRouteConfig = useMemo(
    () => getEffectiveMapRouteConfig(routeConfig),
    [routeConfig]
  );

  if (normalizedRoutePoints.length >= 2) {
    return (
      <DynamicRoad
        points={normalizedRoutePoints}
        routeConfig={effectiveRouteConfig}
        overviewTint={overviewTint}
        onTap={onTap}
      />
    );
  }

  if (config.type === 'curved' && config.segments) {
    return (
      <CurvedRoad
        config={config}
        isEastWest={isEastWest}
        overviewTint={overviewTint}
        onTap={onTap}
      />
    );
  }

  if (config.type === 'placeholder') {
    return (
      <PlaceholderRoad
        config={config}
        roadThickness={roadThickness}
        roadOffset={roadOffset}
        isEastWest={isEastWest}
        overviewTint={overviewTint}
      />
    );
  }

  if (config.type === 'custom' && config.imagePath) {
    return (
      <>
        <ImageOverlay
          url={config.imagePath}
          bounds={config.bounds as LatLngBoundsExpression}
          opacity={config.opacity}
          zIndex={config.zIndex}
        />
        {overviewTint && (
          <Rectangle
            bounds={config.bounds as LatLngBoundsExpression}
            pathOptions={{
              stroke: false,
              fillColor: ROAD_STYLE.overviewTintColor,
              fillOpacity: ROAD_STYLE.overviewTintOpacity,
            }}
          />
        )}
      </>
    );
  }

  if (config.type === 'illustration' && config.imagePath) {
    return (
      <>
        <ImageOverlay
          url={config.imagePath}
          bounds={config.bounds as LatLngBoundsExpression}
          opacity={config.opacity}
          zIndex={config.zIndex}
        />
        {overviewTint && (
          <Rectangle
            bounds={config.bounds as LatLngBoundsExpression}
            pathOptions={{
              stroke: false,
              fillColor: ROAD_STYLE.overviewTintColor,
              fillOpacity: ROAD_STYLE.overviewTintOpacity,
            }}
          />
        )}
      </>
    );
  }

  return null;
}

function PlaceholderRoad({
  config,
  overviewTint = false,
}: {
  config: RoadConfig;
  roadThickness: number;
  roadOffset: number;
  isEastWest: boolean;
  overviewTint?: boolean;
}) {
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 1000" preserveAspectRatio="none">
      <rect x="0" y="0" width="100" height="1000" fill="#d4c5b0" opacity="0.85"/>
      <line x1="30" y1="0" x2="30" y2="1000" stroke="#9a8a7a" stroke-width="0.8" opacity="0.5"/>
      <line x1="70" y1="0" x2="70" y2="1000" stroke="#9a8a7a" stroke-width="0.8" opacity="0.5"/>
      <line x1="50" y1="0" x2="50" y2="1000" stroke="#a89070" stroke-width="0.4" stroke-dasharray="10,10" opacity="0.3"/>
      <rect x="0" y="0" width="100" height="1000" fill="url(#roadTexture)" opacity="0.08"/>
      <defs>
        <pattern id="roadTexture" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.5" fill="#8a7a6a"/>
          <circle cx="7" cy="6" r="0.5" fill="#8a7a6a"/>
        </pattern>
      </defs>
    </svg>
  `;

  const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;

  return (
    <>
      <ImageOverlay
        url={svgDataUrl}
        bounds={config.bounds as LatLngBoundsExpression}
        opacity={config.opacity}
        zIndex={config.zIndex}
      />
      {overviewTint && (
        <Rectangle
          bounds={config.bounds as LatLngBoundsExpression}
          pathOptions={{
            stroke: false,
            fillColor: ROAD_STYLE.overviewTintColor,
            fillOpacity: ROAD_STYLE.overviewTintOpacity,
          }}
        />
      )}
    </>
  );
}

function CurvedRoad({
  config,
  isEastWest,
  overviewTint = false,
  onTap,
}: {
  config: RoadConfig;
  isEastWest: boolean;
  overviewTint?: boolean;
  onTap?: (latlng: L.LatLng) => void;
}) {
  const segments = config.segments;

  // 毎レンダーで作り直すと配列の同一性が変わり、RoadSurface 側の useMemo が
  // 一度も効かずに道のポリゴン・通路・縁をすべて計算し直すことになる
  const smoothedCenterline = useMemo(() => {
    if (!segments) return [];
    const anchorPoints = segments
      .map((segment) => {
        const northLat = Math.max(segment.bounds[0][0], segment.bounds[1][0]);
        const southLat = Math.min(segment.bounds[0][0], segment.bounds[1][0]);
        const eastLng = Math.max(segment.bounds[0][1], segment.bounds[1][1]);
        const westLng = Math.min(segment.bounds[0][1], segment.bounds[1][1]);
        if (isEastWest) {
          return {
            lat: segment.centerLine ?? (northLat + southLat) / 2,
            lng: (eastLng + westLng) / 2,
          };
        }
        return {
          lat: (northLat + southLat) / 2,
          lng: segment.centerLine ?? (eastLng + westLng) / 2,
        };
      })
      .sort((a, b) => (isEastWest ? a.lng - b.lng : b.lat - a.lat));
    return smoothPath(densifyPath(anchorPoints, 8), 2);
  }, [segments, isEastWest]);

  if (smoothedCenterline.length < 2) {
    return null;
  }

  return (
    <RoadSurface
      centerline={smoothedCenterline}
      halfWidthMeters={DEFAULT_MAP_ROUTE_CONFIG.roadHalfWidthMeters}
      overviewTint={overviewTint}
      onTap={onTap}
      chainKey="curved-main"
    />
  );
}

/**
 * 道の面・縁・中央通路をまとめて描く。
 *
 * 【輪郭について】
 * 縁は閉じたポリゴンの stroke ではなく、左右2本の独立した線で描く。
 * 閉じた stroke だと道の両端にも線が回り込んで長方形に閉じてしまい、
 * 現実には先へ続いている道が「切り取った紙」に見えるため。
 *
 * 【塗り分けについて】
 * 面を1色で塗らず、中央に彩度を落とした通路帯を重ねる。詳細は config/roadStyle.ts。
 */
function RoadSurface({
  centerline,
  halfWidthMeters,
  overviewTint = false,
  onTap,
  chainKey,
}: {
  centerline: Array<[number, number]>;
  halfWidthMeters: number;
  overviewTint?: boolean;
  onTap?: (latlng: L.LatLng) => void;
  chainKey: string;
}) {
  const zoom = useQuantizedRoadZoom();
  const edgeWeight = getRoadEdgeWeight(zoom);
  const laneWeight = getRoadLaneWeight(zoom);

  const geometry = useMemo(() => {
    const roadPolygon = buildRoadPolygon(centerline, halfWidthMeters);
    const corridorPolygon = buildRoadPolygon(
      centerline,
      getRoadCorridorHalfWidthMeters(halfWidthMeters)
    );
    const edges = buildRoadEdges(centerline, halfWidthMeters);
    return { roadPolygon, corridorPolygon, edges };
  }, [centerline, halfWidthMeters]);

  if (geometry.roadPolygon.length < 3) {
    return null;
  }

  return (
    <>
      {/* 屋台が並ぶ帯（道の全幅）。縁はここでは描かない */}
      <Polygon
        positions={geometry.roadPolygon}
        interactive={false}
        pathOptions={{
          stroke: false,
          fillColor: ROAD_STYLE.surfaceColor,
          fillOpacity: 1,
        }}
      />
      {/* 中央の通路。アスファルトが見えている部分 */}
      {geometry.corridorPolygon.length >= 3 && (
        <Polygon
          positions={geometry.corridorPolygon}
          interactive={false}
          pathOptions={{
            stroke: false,
            fillColor: ROAD_STYLE.corridorColor,
            fillOpacity: 1,
          }}
        />
      )}
      {/* 中央線（車道の白い破線）。俯瞰時はこの下のタイントに隠れるよう先に描く */}
      <Polyline
        positions={centerline}
        interactive={false}
        pathOptions={{
          color: ROAD_STYLE.laneColor,
          weight: laneWeight,
          opacity: ROAD_STYLE.laneOpacity,
          dashArray: getRoadLaneDashArray(zoom),
          lineCap: 'butt',
          lineJoin: 'round',
        }}
      />
      {overviewTint && (
        <Polygon
          positions={geometry.roadPolygon}
          pathOptions={{
            stroke: false,
            fillColor: ROAD_STYLE.overviewTintColor,
            fillOpacity: ROAD_STYLE.overviewTintOpacity,
          }}
          eventHandlers={onTap ? { click: (e) => onTap(e.latlng) } : undefined}
        />
      )}
      {/* 縁は左右それぞれ独立した線。両端は開いたままにする */}
      {(['left', 'right'] as const).map((side) => (
        <Polyline
          key={`road-edge-${chainKey}-${side}`}
          positions={geometry.edges[side]}
          interactive={false}
          pathOptions={{
            color: ROAD_STYLE.edgeColor,
            weight: edgeWeight,
            opacity: ROAD_STYLE.edgeOpacity,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      ))}
      <NoboriMarkersForRoadEdges
        left={geometry.edges.left}
        right={geometry.edges.right}
        chainKey={chainKey}
      />
    </>
  );
}

/**
 * 道の縁の線幅をズームに追従させる。
 *
 * 段階は粗く量子化してあるので、zoomSnap 0.05 の刻みで zoomend が飛んできても
 * 実際に state が変わるのは段階をまたいだときだけ。
 */
function useQuantizedRoadZoom(): number {
  const map = useMap();
  const [zoom, setZoom] = useState(() => quantizeRoadZoom(map.getZoom()));

  useEffect(() => {
    const onZoom = () => {
      const next = quantizeRoadZoom(map.getZoom());
      setZoom((prev) => (prev === next ? prev : next));
    };
    map.on('zoomend', onZoom);
    return () => {
      map.off('zoomend', onZoom);
    };
  }, [map]);

  return zoom;
}

/**
 * 中央線の破線は実寸で決まるのでズームに連続で追従するが、zoomSnap 0.05 の刻みごとに
 * 書き換えると DOM への書き込みが増える。MapLibre 側の step と同じ刻みに丸めて、
 * 両者の見え方を揃えつつ書き換え回数を抑える。
 */
function quantizeRoadZoom(zoom: number): number {
  // 切り捨てなのは MapLibre 側の step 式に合わせるため。四捨五入だと刻みの半分だけ
  // 早く次の段階へ上がり、たとえばズーム 19.8 で Leaflet 側だけ縁 3px・中央線 2px、
  // MapLibre 側は 2.5px・1.5px という食い違いが出る
  return Math.floor(zoom / ROAD_LANE_DASH_ZOOM_STEP) * ROAD_LANE_DASH_ZOOM_STEP;
}

export default memo(RoadOverlay);

function DynamicRoad({
  points,
  routeConfig,
  overviewTint = false,
  onTap,
}: {
  points: MapRoutePoint[];
  routeConfig: MapRouteConfig;
  overviewTint?: boolean;
  onTap?: (latlng: L.LatLng) => void;
}) {
  const chainGeometry = useMemo(() => {
    const chains = getRouteChains(points);
    return chains
      .map((chain) => {
        const anchorPoints = chain.points.map((point) => ({
          lat: point.lat,
          lng: point.lng,
        }));
        const centerline = densifyPath(anchorPoints, 6);
        const smoothedCenterline =
          chain.points.length >= 3 ? smoothRoutePath(centerline, 2) : centerline;

        if (smoothedCenterline.length < 2) {
          return null;
        }

        return {
          key: chain.key,
          smoothedCenterline,
        };
      })
      .filter((item): item is { key: string; smoothedCenterline: Array<[number, number]> } => Boolean(item));
  }, [points]);

  if (chainGeometry.length === 0) {
    return null;
  }

  return (
    <>
      {chainGeometry.map((chain) => {
        return (
          <Fragment key={chain.key}>
            <RoadSurface
              centerline={chain.smoothedCenterline}
              halfWidthMeters={routeConfig.roadHalfWidthMeters}
              overviewTint={overviewTint}
              onTap={onTap}
              chainKey={chain.key}
            />
          </Fragment>
        );
      })}
    </>
  );
}

// ===== のぼり旗 =====

function createNoboriIcon(): L.DivIcon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 32" width="8" height="32">
    <rect x="0" y="0" width="1.5" height="32" fill="#92400e" rx="0.5"/>
    <rect x="0" y="0.5" width="7.5" height="1.2" fill="#92400e" rx="0.4"/>
    <rect x="1.5" y="0.5" width="6" height="20" rx="0.5" fill="#dc2626" opacity="0.88"/>
    <rect x="2.5" y="4" width="3.5" height="1" fill="white" opacity="0.75"/>
    <rect x="2.5" y="7.5" width="3.5" height="1" fill="white" opacity="0.75"/>
    <rect x="2.5" y="11" width="3.5" height="1" fill="white" opacity="0.75"/>
    <rect x="2.5" y="14.5" width="3.5" height="1" fill="white" opacity="0.75"/>
    <rect x="2.5" y="18" width="3.5" height="1" fill="white" opacity="0.75"/>
  </svg>`;
  return L.divIcon({
    className: 'map-nobori-icon',
    html: svg,
    iconSize: [8, 32],
    iconAnchor: [0, 32],
  });
}

/**
 * のぼり旗を道の両サイドに立てる。
 *
 * 以前は中心線の上に並べていたが、そこは来訪者が歩く通路にあたるため、
 * 通路の真ん中に旗が立っている状態になっていた。旗は店の脇に立つものなので、
 * 道の左右の縁へ交互に振り分ける。
 */
const NoboriMarkersForRoadEdges = memo(function NoboriMarkersForRoadEdges({
  left,
  right,
  chainKey,
}: {
  left: Array<[number, number]>;
  right: Array<[number, number]>;
  chainKey: string;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [map]);

  const flagPoints = useMemo(() => {
    const count = Math.min(left.length, right.length);
    if (zoom < 16 || count === 0) return [];
    const step = Math.max(5, Math.ceil(count / 13));
    const points: Array<[number, number]> = [];
    for (let i = 0; i < count; i += step) {
      // 片側に寄らないよう、サンプリングのたびに左右を入れ替える
      points.push(Math.floor(i / step) % 2 === 0 ? left[i] : right[i]);
    }
    return points;
  }, [zoom, left, right]);

  const icon = useMemo(() => createNoboriIcon(), []);

  if (flagPoints.length === 0) return null;

  return (
    <>
      {flagPoints.map((point, i) => (
        <Marker
          key={`nobori-${chainKey}-${i}`}
          position={point}
          icon={icon}
          interactive={false}
          keyboard={false}
          zIndexOffset={-100}
        />
      ))}
    </>
  );
});
