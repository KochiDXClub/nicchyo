"use client";

/**
 * マップの表示範囲を目で見て決める編集画面
 *
 * 数値を入力する画面にしなかったのは、緯度経度を打ち込んでも
 * 「どこまで見えるか」が想像できないため。地図の上に今の範囲を長方形で出し、
 * 四隅をドラッグして決める。保存すると来訪者のマップ（MapLibre 版）の
 * 可動範囲になる。
 *
 * 範囲の決め方は2つ。
 * - 自動: 道の範囲＋余白（m）。道を編集すると追従する
 * - 手動: ドラッグで決めた長方形をそのまま使う
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Loader2, RotateCcw, Save } from "lucide-react";
import type { MapRoute } from "@/app/(public)/map/types/mapRoute";
import {
  getRouteBounds,
  getRouteChains,
  normalizeMapRoutePoints,
} from "@/app/(public)/map/utils/mapRouteGeometry";
import {
  DEFAULT_MAP_VIEW_SETTINGS,
  MAP_VIEW_LIMITS,
  containsRouteBounds,
  resolveMapViewBounds,
  toMapViewBounds,
  type MapViewBounds,
  type MapViewSettings,
} from "@/lib/map/mapViewSettings";

/** MapLibre は 512px タイル基準なので、Leaflet 基準のズーム値から 1 引く */
const ZOOM_OFFSET = -1;

const CARTO_TILES = ["a", "b", "c", "d"].map(
  (s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`
);

/**
 * 下敷きの地図。MapLibre は渡したスタイルを書き換えることがあるので、
 * 使い回さず毎回組み立てる
 */
function buildPreviewStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: CARTO_TILES,
        tileSize: 256,
        maxzoom: 20,
        attribution:
          '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#FFFAF0" } },
      { id: "basemap", type: "raster", source: "carto", paint: { "raster-opacity": 0.85 } },
    ],
  };
}

const SRC_RANGE = "range";
const SRC_ROAD = "road";

type Corner = "nw" | "ne" | "se" | "sw";
const CORNERS: Corner[] = ["nw", "ne", "se", "sw"];

function cornerLngLat(bounds: MapViewBounds, corner: Corner): [number, number] {
  switch (corner) {
    case "nw":
      return [bounds.west, bounds.north];
    case "ne":
      return [bounds.east, bounds.north];
    case "se":
      return [bounds.east, bounds.south];
    case "sw":
      return [bounds.west, bounds.south];
  }
}

/**
 * 四隅のドラッグを長方形に反映する。
 * 対辺を追い越して潰れた枠にならないよう、最小の一辺だけは必ず残す。
 */
function moveCorner(bounds: MapViewBounds, corner: Corner, lat: number, lng: number): MapViewBounds {
  const gap = MAP_VIEW_LIMITS.spanDeg.min;
  const next = { ...bounds };
  if (corner === "nw" || corner === "ne") {
    next.north = Math.max(lat, bounds.south + gap);
  } else {
    next.south = Math.min(lat, bounds.north - gap);
  }
  if (corner === "ne" || corner === "se") {
    next.east = Math.max(lng, bounds.west + gap);
  } else {
    next.west = Math.min(lng, bounds.east - gap);
  }
  return next;
}

function rangeGeoJSON(bounds: MapViewBounds): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [bounds.west, bounds.north],
              [bounds.east, bounds.north],
              [bounds.east, bounds.south],
              [bounds.west, bounds.south],
              [bounds.west, bounds.north],
            ],
          ],
        },
      },
    ],
  };
}

function roadGeoJSON(route: MapRoute): GeoJSON.FeatureCollection {
  const points = normalizeMapRoutePoints(route.points ?? []);
  return {
    type: "FeatureCollection",
    features: getRouteChains(points).map((chain) => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: chain.points.map((point) => [point.lng, point.lat]),
      },
    })),
  };
}

/** 長方形の大きさを「およそ何 m ×何 m」で表す（数値だけだと広さが掴めないため） */
function describeSize(bounds: MapViewBounds): string {
  const centerLat = (bounds.north + bounds.south) / 2;
  const heightM = (bounds.north - bounds.south) * 111320;
  const widthM = (bounds.east - bounds.west) * 111320 * Math.cos((centerLat * Math.PI) / 180);
  const fmt = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)}km` : `${Math.round(m)}m`);
  return `${fmt(widthM)} × ${fmt(heightM)}`;
}

export default function MapViewRangeClient() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Partial<Record<Corner, maplibregl.Marker>>>({});
  const [mapReady, setMapReady] = useState(false);

  const [settings, setSettings] = useState<MapViewSettings>(DEFAULT_MAP_VIEW_SETTINGS);
  const [route, setRoute] = useState<MapRoute | null>(null);
  const [renderer, setRenderer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  /** 保存後の見え方を確かめるモード。オンのあいだは地図が範囲の外へ出られなくなる */
  const [restrictPreview, setRestrictPreview] = useState(false);

  const routeBounds = useMemo(
    () => (route ? getRouteBounds(normalizeMapRoutePoints(route.points ?? [])) : null),
    [route]
  );
  const resolvedBounds = useMemo(
    () => (routeBounds ? resolveMapViewBounds(settings, routeBounds) : null),
    [settings, routeBounds]
  );
  const coversRoute = useMemo(
    () => (resolvedBounds && routeBounds ? containsRouteBounds(resolvedBounds, routeBounds) : true),
    [resolvedBounds, routeBounds]
  );

  // 描画中の値をイベントハンドラから読むための ref（地図の初期化は1回だけなので）
  const resolvedBoundsRef = useRef<MapViewBounds | null>(null);
  resolvedBoundsRef.current = resolvedBounds;
  /** ドラッグ中のつまみ。位置を上書きするとドラッグと取り合いになるので除ける */
  const draggingCornerRef = useRef<Corner | null>(null);

  // ---- 読み込み ----
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/map-view", { cache: "no-store" });
        const json = await res.json();
        if (aborted) return;
        if (!res.ok) {
          setMessage({ kind: "error", text: json?.error ?? "設定を読み込めませんでした" });
          return;
        }
        setSettings(json.settings as MapViewSettings);
        setRoute(json.route as MapRoute);
        setRenderer(typeof json.renderer === "string" ? json.renderer : null);
      } catch {
        if (!aborted) setMessage({ kind: "error", text: "設定を読み込めませんでした" });
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  // ---- 地図の初期化（データが揃ってから1回だけ）----
  // 範囲は ref から読む。resolvedBounds を依存に入れると、四隅をドラッグする
  // たびに地図が作り直されてしまう
  useEffect(() => {
    const container = containerRef.current;
    const initialBounds = resolvedBoundsRef.current;
    if (!container || !route || !initialBounds || mapRef.current) return;

    const map = new maplibregl.Map({
      container,
      style: buildPreviewStyle(),
      bounds: [
        [initialBounds.west, initialBounds.south],
        [initialBounds.east, initialBounds.north],
      ],
      fitBoundsOptions: { padding: 48 },
      attributionControl: { compact: true },
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource(SRC_ROAD, { type: "geojson", data: roadGeoJSON(route) });
      map.addLayer({
        id: "road-line",
        type: "line",
        source: SRC_ROAD,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#7ED957", "line-width": 6, "line-opacity": 0.9 },
      });

      map.addSource(SRC_RANGE, {
        type: "geojson",
        data: rangeGeoJSON(resolvedBoundsRef.current ?? initialBounds),
      });
      map.addLayer({
        id: "range-fill",
        type: "fill",
        source: SRC_RANGE,
        paint: { "fill-color": "#3A3A3A", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "range-outline",
        type: "line",
        source: SRC_RANGE,
        paint: { "line-color": "#3A3A3A", "line-width": 2, "line-dasharray": [3, 2] },
      });
      setMapReady(true);
    });

    return () => {
      Object.values(markersRef.current).forEach((marker) => marker?.remove());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [route]);

  // ---- 長方形と四隅のつまみを描き直す ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !resolvedBounds) return;

    const source = map.getSource(SRC_RANGE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(rangeGeoJSON(resolvedBounds));

    for (const corner of CORNERS) {
      const lngLat = cornerLngLat(resolvedBounds, corner);
      const existing = markersRef.current[corner];
      if (existing) {
        if (draggingCornerRef.current !== corner) existing.setLngLat(lngLat);
        continue;
      }
      const el = document.createElement("div");
      el.className =
        "h-4 w-4 cursor-grab rounded-full border-2 border-white bg-slate-900 shadow-md active:cursor-grabbing";
      el.setAttribute("aria-label", `表示範囲の${corner}角`);
      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(lngLat)
        .addTo(map);
      marker.on("dragstart", () => {
        draggingCornerRef.current = corner;
      });
      marker.on("dragend", () => {
        draggingCornerRef.current = null;
        // 端で丸めた場合につまみの位置を長方形へ揃え直す
        const current = resolvedBoundsRef.current;
        if (current) marker.setLngLat(cornerLngLat(current, corner));
      });
      marker.on("drag", () => {
        const current = resolvedBoundsRef.current;
        if (!current) return;
        const { lat, lng } = marker.getLngLat();
        // ドラッグした時点で「手動」に切り替える。自動のまま四隅だけ動かせると、
        // 保存後に道の範囲から計算し直されて操作が消える
        setSettings((prev) => ({
          ...prev,
          mode: "manual",
          bounds: moveCorner(current, corner, lat, lng),
        }));
      });
      markersRef.current[corner] = marker;
    }
  }, [mapReady, resolvedBounds]);

  // ---- 「この範囲を試す」: 実際の可動範囲と最小ズームを編集用の地図にも掛ける ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !resolvedBounds) return;
    if (restrictPreview) {
      map.setMaxBounds([
        [resolvedBounds.west, resolvedBounds.south],
        [resolvedBounds.east, resolvedBounds.north],
      ]);
      map.setMinZoom(settings.minZoom + ZOOM_OFFSET);
    } else {
      map.setMaxBounds(null);
      map.setMinZoom(1);
    }
  }, [mapReady, restrictPreview, resolvedBounds, settings.minZoom]);

  const useCurrentView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    setSettings((prev) => ({
      ...prev,
      mode: "manual",
      bounds: toMapViewBounds([
        [b.getNorth(), b.getEast()],
        [b.getSouth(), b.getWest()],
      ]),
    }));
  }, []);

  const fitToRange = useCallback(() => {
    const map = mapRef.current;
    const bounds = resolvedBoundsRef.current;
    if (!map || !bounds) return;
    map.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding: 48, duration: 400 }
    );
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/map-view", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ kind: "error", text: json?.error ?? "保存できませんでした" });
        return;
      }
      setSettings(json.settings as MapViewSettings);
      setMessage({ kind: "ok", text: "保存しました。マップを再読み込みすると反映されます。" });
    } catch {
      setMessage({ kind: "error", text: "保存できませんでした" });
    } finally {
      setSaving(false);
    }
  }, [settings]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderer && renderer !== "maplibre" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          いまの描画ライブラリは <strong>{renderer}</strong> です。この表示範囲が効くのは MapLibre
          版の描画だけなので、来訪者のマップに反映するには「設定」で描画ライブラリを maplibre
          にしてください（?mapFlags=renderer:maplibre でも確かめられます）。
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* 地図 */}
        <div className="relative h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div ref={containerRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow">
            黒い四隅をドラッグして範囲を決める
          </div>
        </div>

        {/* 操作 */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-semibold text-slate-900">範囲の決め方</legend>
            <label className="flex items-start gap-2 text-[13px] text-slate-700">
              <input
                type="radio"
                name="map-view-mode"
                className="mt-1"
                checked={settings.mode === "auto"}
                onChange={() => setSettings((prev) => ({ ...prev, mode: "auto" }))}
              />
              <span>
                自動（道の範囲＋余白）
                <span className="block text-[11px] text-slate-400">道を編集すると範囲も追従する</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-[13px] text-slate-700">
              <input
                type="radio"
                name="map-view-mode"
                className="mt-1"
                checked={settings.mode === "manual"}
                disabled={!settings.bounds}
                onChange={() => setSettings((prev) => ({ ...prev, mode: "manual" }))}
              />
              <span>
                手動（四隅で決めた長方形）
                <span className="block text-[11px] text-slate-400">
                  {settings.bounds ? "道を編集しても範囲は変わらない" : "地図の四隅をドラッグすると選べる"}
                </span>
              </span>
            </label>
          </fieldset>

          {settings.mode === "auto" ? (
            <label className="block space-y-1">
              <span className="text-[13px] font-semibold text-slate-900">
                余白: {Math.round(settings.paddingMeters)}m
              </span>
              <input
                type="range"
                className="w-full"
                min={MAP_VIEW_LIMITS.paddingMeters.min}
                max={3000}
                step={20}
                value={settings.paddingMeters}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, paddingMeters: Number(e.target.value) }))
                }
              />
              <span className="block text-[11px] text-slate-400">
                道の範囲の外側にこれだけ足す。広げるほど遠くまで動かせる
              </span>
            </label>
          ) : (
            <button
              type="button"
              onClick={useCurrentView}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              いま見えている範囲を取り込む
            </button>
          )}

          <label className="block space-y-1">
            <span className="text-[13px] font-semibold text-slate-900">
              どこまで引けるか: ズーム {settings.minZoom}
            </span>
            <input
              type="range"
              className="w-full"
              min={MAP_VIEW_LIMITS.minZoom.min}
              max={MAP_VIEW_LIMITS.minZoom.max}
              step={0.5}
              value={settings.minZoom}
              onChange={(e) => setSettings((prev) => ({ ...prev, minZoom: Number(e.target.value) }))}
            />
            <span className="block text-[11px] text-slate-400">
              小さいほど広く引ける（既定は {DEFAULT_MAP_VIEW_SETTINGS.minZoom}）。
              長方形が画面に収まる倍率までしか引けないので、範囲が狭いとここを下げても効かない
            </span>
          </label>

          <label className="flex items-center gap-2 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={restrictPreview}
              onChange={(e) => setRestrictPreview(e.target.checked)}
            />
            この範囲で動かしてみる
          </label>

          {resolvedBounds ? (
            <dl className="space-y-1 rounded-lg bg-slate-50 p-3 text-[12px] text-slate-600">
              <div className="flex justify-between">
                <dt>大きさ</dt>
                <dd className="font-mono">{describeSize(resolvedBounds)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>北 / 南</dt>
                <dd className="font-mono">
                  {resolvedBounds.north.toFixed(5)} / {resolvedBounds.south.toFixed(5)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>東 / 西</dt>
                <dd className="font-mono">
                  {resolvedBounds.east.toFixed(5)} / {resolvedBounds.west.toFixed(5)}
                </dd>
              </div>
            </dl>
          ) : null}

          {!coversRoute ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              道の全体が範囲に入っていません。このままでは市場の端の店に近づけなくなります。
            </p>
          ) : null}

          {message ? (
            <p
              className={`rounded-lg px-3 py-2 text-[12px] ${
                message.kind === "ok"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSettings(DEFAULT_MAP_VIEW_SETTINGS);
                setMessage(null);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              既定に戻す
            </button>
            <button
              type="button"
              onClick={fitToRange}
              className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              範囲に合わせる
            </button>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving || !coversRoute}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存する
          </button>
        </div>
      </div>
    </div>
  );
}
