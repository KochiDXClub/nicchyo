"use client";

/**
 * 現地で店舗の位置を決める地図（MapLibre）。
 * - 地図をタップするか、ピンをドラッグして置く。現在地ボタンは親が value を更新する
 * - 周りの区画を小さな点で出す（緑=配置済み、灰=空き）。点をタップすると、その店番を選べる
 * 背景・ワーカーの設定は公開マップと同じもの（maplibreWorker / basemap）を使う。
 */

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/lib/map/maplibreWorker";
import { OPENFREEMAP_STYLE_URL } from "@/app/(public)/map/config/basemap";

export type FieldLocation = {
  storeNumber: number;
  lat: number;
  lng: number;
  vendorId: string | null;
  vendorName: string | null;
};

export type LatLng = { lat: number; lng: number };

/** 日曜市の中心（高知城前〜追手筋東端の中間あたり） */
const DEFAULT_CENTER: LatLng = { lat: 33.5614, lng: 133.5385 };
const OTHERS_SOURCE = "field-others";

type Props = {
  locations: FieldLocation[];
  value: LatLng | null;
  onChange: (next: LatLng) => void;
  /** 周りの区画の点をタップしたとき */
  onPickStoreNumber?: (storeNumber: number) => void;
};

function toGeoJson(locations: FieldLocation[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: locations.map((l) => ({
      type: "Feature",
      properties: { storeNumber: l.storeNumber, assigned: l.vendorId !== null },
      geometry: { type: "Point", coordinates: [l.lng, l.lat] },
    })),
  };
}

export function LocationPicker({ locations, value, onChange, onPickStoreNumber }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);
  // 地図の作成は 1 回だけなので、最新の値・関数は ref 経由で読む
  const onChangeRef = useRef(onChange);
  const onPickRef = useRef(onPickStoreNumber);
  const locationsRef = useRef(locations);
  onChangeRef.current = onChange;
  onPickRef.current = onPickStoreNumber;
  locationsRef.current = locations;

  useEffect(() => {
    if (!containerRef.current) return;
    const start = value ?? DEFAULT_CENTER;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: [start.lng, start.lat],
      zoom: 18,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource(OTHERS_SOURCE, { type: "geojson", data: toGeoJson(locationsRef.current) });
      map.addLayer({
        id: "field-others-circle",
        type: "circle",
        source: OTHERS_SOURCE,
        paint: {
          "circle-radius": 6,
          "circle-color": ["case", ["get", "assigned"], "#7ED957", "#9ca3af"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });
      loadedRef.current = true;
    });

    map.on("click", "field-others-circle", (e) => {
      const n = e.features?.[0]?.properties?.storeNumber;
      if (typeof n === "number") onPickRef.current?.(n);
      // 点をタップしたときは、ピンは動かさない
      (e as unknown as { originalEvent: { __fieldHandled?: boolean } }).originalEvent.__fieldHandled = true;
    });
    map.on("click", (e) => {
      if ((e.originalEvent as unknown as { __fieldHandled?: boolean }).__fieldHandled) return;
      onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // 地図は 1 回だけ作る（value の変化は下の effect で反映する）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 周りの区画の更新
  useEffect(() => {
    const source = mapRef.current?.getSource(OTHERS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(toGeoJson(locations));
  }, [locations]);

  // ピンの位置の反映（親が value を変えたとき: 現在地・店番の選び直し・タップ）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const marker = new maplibregl.Marker({ draggable: true, color: "#e11d48" }).setLngLat([value.lng, value.lat]).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLngLat();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([value.lng, value.lat]);
    }
    map.easeTo({ center: [value.lng, value.lat], duration: 300 });
  }, [value]);

  return <div ref={containerRef} className="h-80 w-full overflow-hidden rounded-xl border border-slate-200" />;
}
