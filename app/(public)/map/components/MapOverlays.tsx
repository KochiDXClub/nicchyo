'use client';

import { Fragment, memo, useCallback, useEffect, useState } from "react";
import type { ComponentType } from "react";
import type { OptimizedShopLayerWithClusteringProps } from "./OptimizedShopLayerWithClustering";
import { CircleMarker, Marker, Pane, Popup, Rectangle, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { Landmark } from "../types/landmark";
import type { Shop } from "../data/shops";
import type { ShopBannerOrigin } from "./MapView";
import type { MapRouteConfig, MapRoutePoint } from "../types/mapRoute";
import RoadOverlay from "./RoadOverlay";
import ChomeAreaMarkers from "./ChomeAreaMarkers";

const MIN_ZOOM_LABEL_NAMES = new Set(["高知城", "高知駅", "チンチン電車"]);
const MIN_ZOOM_ONLY_LABEL = { name: "日曜市", lat: 33.56145, lng: 133.5383 };

export const MapOverlays = memo(function MapOverlays({
  isLowZoomTintMode,
  routePoints,
  routeConfig,
  mapBounds,
  visibleMajorPlaceLabels,
  shouldRenderEventGlow,
  eventTargets,
  highlightEventTargets,
  visibleLandmarkSpecs,
  landmarkIcons,
  isMinimumZoomMode,
  isOverviewZoneMode,
  shops,
  onShopClick,
  onChunkProgress,
  selectedShopId,
  favoriteShopIds,
  searchShopIds,
  aiHighlightShopIds,
  commentHighlightShopIds,
  kotoduteShopIds,
  recipeIngredientIconsByShop,
  attendanceLabelsByShop,
  bagShopIds,
  shouldRenderRecipeOverlay,
  shopsWithIngredients,
  recipeIngredients,
  onRecipeShopClick,
  OptimizedShopLayerWithClustering,
}: {
  isLowZoomTintMode: boolean;
  routePoints: MapRoutePoint[];
  routeConfig: MapRouteConfig;
  mapBounds: [[number, number], [number, number]];
  visibleMajorPlaceLabels: Array<{ name: string; lat: number; lng: number }>;
  shouldRenderEventGlow: boolean;
  eventTargets?: Array<{ id: string | number; lat: number; lng: number }>;
  highlightEventTargets: boolean;
  visibleLandmarkSpecs: Landmark[];
  landmarkIcons: Map<string, L.DivIcon>;
  isMinimumZoomMode: boolean;
  isOverviewZoneMode: boolean;
  shops: Shop[];
  onShopClick: (shop: Shop, origin?: ShopBannerOrigin) => void;
  onChunkProgress: (processed: number, total: number, done: boolean) => void;
  selectedShopId?: number;
  favoriteShopIds: number[];
  searchShopIds?: number[];
  aiHighlightShopIds?: number[];
  commentHighlightShopIds?: number[];
  kotoduteShopIds?: number[];
  recipeIngredientIconsByShop: Record<number, string[]>;
  attendanceLabelsByShop: Record<number, string>;
  bagShopIds: number[];
  shouldRenderRecipeOverlay: boolean;
  shopsWithIngredients: Shop[];
  recipeIngredients: Array<{ name: string; icon: string }>;
  onRecipeShopClick: (shop: Shop) => void;
  OptimizedShopLayerWithClustering: ComponentType<OptimizedShopLayerWithClusteringProps>;
}) {
  const map = useMap();
  const handleRoadTap = useCallback((latlng: import("leaflet").LatLng) => {
    map.setView(latlng, 17);
  }, [map]);

  return (
    <>
      <RoadOverlay
        overviewTint={isLowZoomTintMode}
        routePoints={routePoints}
        routeConfig={routeConfig}
        onTap={isLowZoomTintMode && !isOverviewZoneMode ? handleRoadTap : undefined}
      />
      <DynamicMaxBounds baseBounds={mapBounds} paddingPx={100} />

      <Pane name="major-place-label" style={{ zIndex: 950 }}>
        {visibleMajorPlaceLabels.map((place) => (
          <Marker
            key={`major-place-${place.name}`}
            position={[place.lat, place.lng]}
            icon={L.divIcon({
              className: "major-place-label-icon",
              html: `<span class="major-place-label-pill${
                place.name === "日曜市" ? " is-sunday-market" : ""
              }" style="display:inline-block;padding:2px 8px;border-radius:9999px;background:rgba(255,255,255,0.88);border:1px solid rgba(15,23,42,0.15);font-size:11px;font-weight:700;color:#0f172a;white-space:nowrap;">${place.name}</span>`,
              iconSize: [0, 0],
            })}
            interactive={false}
            keyboard={false}
            zIndexOffset={1200}
          />
        ))}
      </Pane>

      <EventDimOverlay active={highlightEventTargets} />

      {shouldRenderEventGlow && (
        <Pane name="event-glow" style={{ zIndex: 2000 }}>
          {eventTargets?.map((target) => (
            <Fragment key={target.id}>
              <CircleMarker
                center={[target.lat, target.lng]}
                radius={20}
                pane="event-glow"
                pathOptions={{
                  fillColor: "transparent",
                  fillOpacity: 0,
                  color: "#ffffff",
                  weight: 2,
                  opacity: 0.9,
                }}
                className="map-event-ripple is-1"
              />
              <CircleMarker
                center={[target.lat, target.lng]}
                radius={30}
                pane="event-glow"
                pathOptions={{
                  fillColor: "transparent",
                  fillOpacity: 0,
                  color: "#ffffff",
                  weight: 2,
                  opacity: 0.7,
                }}
                className="map-event-ripple is-2"
              />
            </Fragment>
          ))}
        </Pane>
      )}

      <Pane name="landmarks" style={{ zIndex: highlightEventTargets ? 3000 : 70 }}>
        {visibleLandmarkSpecs.map((spec) => (
          <Marker
            key={`landmark-${spec.key}`}
            position={[spec.lat, spec.lng]}
            icon={landmarkIcons.get(spec.key) ?? L.divIcon({ className: "map-landmark-icon" })}
            interactive
            keyboard={false}
            opacity={1}
            zIndexOffset={highlightEventTargets ? 1800 : 0}
          >
            <Popup pane="landmark-popup" offset={[0, -18]} className="map-landmark-popup">
              <div className="min-w-[180px] max-w-[220px]">
                <p className="text-sm font-bold text-slate-900">{spec.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{spec.description}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </Pane>
      <Pane name="landmark-popup" style={{ zIndex: 10000 }} />

      {/* 縮小時（zoom < 17）: 丁目エリアバッジ */}
      {!isMinimumZoomMode && isOverviewZoneMode && (
        <ChomeAreaMarkers shops={shops} />
      )}

      {/* 通常時（zoom ≥ 19）: 個別店舗マーカー */}
      {!isMinimumZoomMode && !isOverviewZoneMode && !isLowZoomTintMode && (
        <OptimizedShopLayerWithClustering
          shops={shops}
          onShopClick={onShopClick}
          onChunkProgress={onChunkProgress}
          selectedShopId={selectedShopId}
          favoriteShopIds={favoriteShopIds}
          searchShopIds={searchShopIds}
          aiHighlightShopIds={aiHighlightShopIds}
          commentHighlightShopIds={commentHighlightShopIds}
          kotoduteShopIds={kotoduteShopIds}
          recipeIngredientIconsByShop={recipeIngredientIconsByShop}
          attendanceLabelsByShop={attendanceLabelsByShop}
          bagShopIds={bagShopIds}
        />
      )}

      {!isMinimumZoomMode && shouldRenderRecipeOverlay && shopsWithIngredients.map((shop) => {
        const matchingIngredients = recipeIngredients.filter((ing) =>
          shop.products.some((product) =>
            product.toLowerCase().includes(ing.name.toLowerCase()) ||
            ing.name.toLowerCase().includes(product.toLowerCase())
          )
        );

        return (
          <CircleMarker
            key={`recipe-${shop.id}`}
            center={[shop.lat, shop.lng]}
            radius={40}
            pathOptions={{
              fillColor: "#f59e0b",
              fillOpacity: 0.2,
              color: "#f59e0b",
              weight: 3,
              opacity: 0.8,
            }}
            eventHandlers={{
              click: () => onRecipeShopClick(shop),
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
              <div className="text-xs">
                <div className="mb-1 font-bold">{shop.name}</div>
                <div className="space-y-0.5 text-[10px]">
                  {matchingIngredients.slice(0, 3).map((ing, i) => (
                    <div key={i}>
                      {ing.icon} {ing.name}
                    </div>
                  ))}
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
});

function DynamicMaxBounds({
  baseBounds,
  paddingPx,
}: {
  baseBounds: [[number, number], [number, number]];
  paddingPx: number;
}) {
  const map = useMap();

  useEffect(() => {
    const baseLatLngBounds = L.latLngBounds(baseBounds);

    const updateBounds = () => {
      const zoom = map.getZoom();
      const size = map.getSize();
      const viewportDiagonal = Math.sqrt(size.x * size.x + size.y * size.y);
      const dynamicPaddingPx = Math.max(paddingPx, viewportDiagonal);
      const sw = map.project(baseLatLngBounds.getSouthWest(), zoom);
      const ne = map.project(baseLatLngBounds.getNorthEast(), zoom);
      const paddedSw = L.point(sw.x - dynamicPaddingPx, sw.y + dynamicPaddingPx);
      const paddedNe = L.point(ne.x + dynamicPaddingPx, ne.y - dynamicPaddingPx);
      const paddedBounds = L.latLngBounds(
        map.unproject(paddedSw, zoom),
        map.unproject(paddedNe, zoom)
      );
      map.setMaxBounds(paddedBounds);
    };

    updateBounds();
    map.on("zoom resize move", updateBounds);
    return () => {
      map.off("zoom resize move", updateBounds);
    };
  }, [map, baseBounds, paddingPx]);

  return null;
}

function EventDimOverlay({ active }: { active: boolean }) {
  const map = useMap();
  const [bounds, setBounds] = useState<LatLngBoundsExpression | null>(null);

  useEffect(() => {
    if (!active) return;
    const update = () => {
      setBounds(map.getBounds());
    };
    update();
    map.on("move zoom resize", update);
    return () => {
      map.off("move zoom resize", update);
    };
  }, [map, active]);

  if (!active || !bounds) return null;

  return (
    <Pane name="event-dim" style={{ zIndex: 800 }}>
      <Rectangle
        bounds={bounds}
        pathOptions={{
          color: "transparent",
          weight: 0,
          fillColor: "#050505",
          fillOpacity: 0.55,
        }}
        interactive={false}
      />
    </Pane>
  );
}


export function getVisibleMajorPlaceLabels({
  shouldRenderMajorLabels,
  isMinimumZoomMode,
  majorPlaceLabels,
}: {
  shouldRenderMajorLabels: boolean;
  isMinimumZoomMode: boolean;
  majorPlaceLabels: Array<{ name: string; lat: number; lng: number }>;
}) {
  if (!shouldRenderMajorLabels) {
    return [];
  }
  if (!isMinimumZoomMode) {
    return majorPlaceLabels;
  }
  return [
    ...majorPlaceLabels.filter((place) => MIN_ZOOM_LABEL_NAMES.has(place.name)),
    MIN_ZOOM_ONLY_LABEL,
  ];
}
