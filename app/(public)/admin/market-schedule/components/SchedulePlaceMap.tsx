"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/lib/map/maplibreWorker";
import { EDITOR_COLORS } from "@/app/(public)/map-edit/v3/editorTheme";
import { OPENFREEMAP_STYLE_URL } from "@/app/(public)/map/config/basemap";
import { formatMarketAddress } from "@/lib/market-schedule/address";
import type { PlaceRow } from "@/lib/market-schedule/adminTypes";

const SOURCE = "schedule-places";
const POINTS = "schedule-place-points";

export function placeMapFeatures(places: PlaceRow[], selected: string): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return { type: "FeatureCollection", features: places.flatMap((place) => {
    const lat = place.latitude, lng = place.longitude;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return [];
    return [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [lng, lat] }, properties: {
      id: place.id, selected: place.id === selected,
      label: place.official_number == null ? String(place.store_number) : formatMarketAddress({ main: place.official_number, branch: place.branch_number }),
    } }];
  }) };
}

type Props = { places: PlaceRow[]; selected: string; onSelect: (id: string) => void };
export function SchedulePlaceMap({ places, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  const dataRef = useRef(placeMapFeatures(places, selected));
  const [failed, setFailed] = useState(false);
  onSelectRef.current = onSelect;
  dataRef.current = placeMapFeatures(places, selected);

  useEffect(() => {
    if (!container.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: container.current, style: OPENFREEMAP_STYLE_URL, center: [133.5385, 33.5614], zoom: 16, attributionControl: { compact: true }, cooperativeGestures: true });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource(SOURCE, { type: "geojson", data: dataRef.current });
      map.addLayer({ id: POINTS, type: "circle", source: SOURCE, paint: { "circle-radius": ["case", ["get", "selected"], 12, 9], "circle-color": ["case", ["get", "selected"], EDITOR_COLORS.selectedSlot, EDITOR_COLORS.previewCreate], "circle-stroke-width": 2, "circle-stroke-color": EDITOR_COLORS.surface } });
      map.addLayer({ id: "schedule-place-labels", type: "symbol", source: SOURCE, layout: { "text-field": ["get", "label"], "text-size": 11, "text-offset": [0, 1.5], "text-anchor": "top", "text-allow-overlap": false }, paint: { "text-color": EDITOR_COLORS.ink, "text-halo-color": EDITOR_COLORS.surface, "text-halo-width": 2 } });
      map.on("click", POINTS, (event) => { const id = event.features?.[0]?.properties?.id; if (typeof id === "string") onSelectRef.current(id); });
      map.on("mouseenter", POINTS, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", POINTS, () => { map.getCanvas().style.cursor = ""; });
    });
    return () => { mapRef.current = null; map.remove(); };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(dataRef.current);
    const point = dataRef.current.features.find((feature) => feature.properties?.id === selected);
    if (point) map.easeTo({ center: point.geometry.coordinates as [number, number], duration: 300 });
  }, [places, selected]);

  return <div>
    {failed && <p role="status" className="p-3 text-sm">地図を表示できません。場所の一覧から選んでください。</p>}
    <div ref={container} aria-label="出店場所の地図" className="h-72 w-full overflow-hidden rounded-lg" />
    <p className="mt-2 text-xs text-nicchyo-ink/70">点を選ぶと場所の予定を表示します。スマートフォンでは指２本で地図を動かせます。位置未設定の場所は一覧から選べます。</p>
  </div>;
}
