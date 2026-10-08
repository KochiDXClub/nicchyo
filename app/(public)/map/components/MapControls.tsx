"use client";

/**
 * 右側の操作部品: 縦ズームスライダーと現在地追従ボタン。
 * 地図には MapCamera（types/mapCamera.ts）経由でだけ触るので、Leaflet 版と MapLibre 版で共用できる。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Navigation } from "lucide-react";
import type { MapCamera } from "../types/mapCamera";
// ===== テーパー型縦ズームスライダー =====
// 上端（拡大側）が太く、下端（縮小側）が細いくさび形のトラックで操作方向を直感的に伝える
const VZ_PAD = 14;        // 上下パディング（サムがはみ出ないように）
const VZ_TRACK_H = 156;   // トラック高さ
const VZ_SVG_W = 34;
const VZ_SVG_H = VZ_TRACK_H + VZ_PAD * 2;
const VZ_WIDE = 22;       // 上端（拡大）の幅
const VZ_NARROW = 8.5;    // 下端（縮小）の幅
const VZ_CX = VZ_SVG_W / 2;
const VZ_L_TOP = VZ_CX - VZ_WIDE / 2;
const VZ_R_TOP = VZ_CX + VZ_WIDE / 2;
const VZ_L_BOT = VZ_CX - VZ_NARROW / 2;
const VZ_R_BOT = VZ_CX + VZ_NARROW / 2;

function VerticalZoomSlider({
  value,
  min,
  max,
  onValueChange,
}: {
  value: number;
  min: number;
  max: number;
  onValueChange: (v: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);

  const trackTop = VZ_PAD;
  const trackBot = VZ_PAD + VZ_TRACK_H;

  const pct = (value - min) / (max - min);           // 0=最小, 1=最大
  const thumbY = trackTop + VZ_TRACK_H * (1 - pct); // 上=拡大, 下=縮小

  // アンバー塗り: サムから下端まで（塗りが多い＝よりズームインしている）
  const fillRatio = (thumbY - trackTop) / VZ_TRACK_H;
  const fillTL = VZ_L_TOP + (VZ_L_BOT - VZ_L_TOP) * fillRatio;
  const fillTR = VZ_R_TOP + (VZ_R_BOT - VZ_R_TOP) * fillRatio;
  const trackPts = `${VZ_L_TOP},${trackTop} ${VZ_R_TOP},${trackTop} ${VZ_R_BOT},${trackBot} ${VZ_L_BOT},${trackBot}`;
  const fillPts  = `${fillTL},${thumbY} ${fillTR},${thumbY} ${VZ_R_BOT},${trackBot} ${VZ_L_BOT},${trackBot}`;

  const getValueFromY = useCallback(
    (clientY: number): number => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return value;
      const relY = Math.max(0, Math.min(VZ_TRACK_H, clientY - rect.top - VZ_PAD));
      return min + (1 - relY / VZ_TRACK_H) * (max - min);
    },
    [min, max, value],
  );

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    isDragging.current = true;
    svgRef.current?.setPointerCapture(e.pointerId);
    onValueChange(getValueFromY(e.clientY));
    e.stopPropagation();
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    onValueChange(getValueFromY(e.clientY));
    e.stopPropagation();
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isDragging.current = false;
    e.stopPropagation();
  };

  return (
    <svg
      ref={svgRef}
      width={VZ_SVG_W}
      height={VZ_SVG_H}
      style={{ cursor: "ns-resize", touchAction: "none", display: "block" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="slider"
      aria-label="ズーム"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      {/* グレーのトラック（くさび形） */}
      <polygon points={trackPts} fill="#e5e7eb" />
      {/* アンバー塗り（現在のズームレベルを表す） */}
      <polygon points={fillPts} fill="#d97706" opacity="0.65" />
      {/* サム */}
      <circle cx={VZ_CX} cy={thumbY} r={8.5} fill="white" stroke="#d97706" strokeWidth="3" />
    </svg>
  );
}

// ===== Spotlight countdown bar: 2s amber progress bar shown during spotlight mode =====
// ===== Right-side controls: zoom slider (bottom) + tracking button (above nav bar) =====
export function MapControls({
  map,
  isTracking,
  onToggleTracking,
  currentZoom,
  minZoom,
  maxZoom,
  zoomSliderVisible,
  onZoomSliderInteract,
  trackingButtonTop = 112,
}: {
  map: MapCamera | null;
  isTracking: boolean;
  onToggleTracking: () => void;
  currentZoom: number;
  minZoom: number;
  maxZoom: number;
  /** 2本指操作時のみ true。false のときズームスライダーをフェードアウトさせる */
  zoomSliderVisible: boolean;
  /** スライダー操作時に表示を延命させるためのコールバック */
  onZoomSliderInteract: () => void;
  /** 現在地ボタンの top 位置（px）。検索エリアの高さに追従させるために外から渡す */
  trackingButtonTop?: number;
}) {
  const zoomFrameRef = useRef<number | null>(null);
  const pendingZoomRef = useRef<number | null>(null);

  const flushZoom = useCallback(() => {
    zoomFrameRef.current = null;
    const pendingZoom = pendingZoomRef.current;
    pendingZoomRef.current = null;
    if (pendingZoom === null || !map) return;
    const nextZoom = Math.max(minZoom, Math.min(maxZoom, pendingZoom));
    if (Math.abs(nextZoom - map.getZoom()) <= 0.001) return;
    map.setZoom(nextZoom, { animate: false });
  }, [map, maxZoom, minZoom]);

  const handleZoomValueChange = useCallback((value: number) => {
    onZoomSliderInteract();
    pendingZoomRef.current = value;
    if (zoomFrameRef.current !== null) {
      return;
    }
    zoomFrameRef.current = window.requestAnimationFrame(flushZoom);
  }, [flushZoom, onZoomSliderInteract]);

  useEffect(() => {
    return () => {
      if (zoomFrameRef.current !== null) {
        window.cancelAnimationFrame(zoomFrameRef.current);
      }
    };
  }, [flushZoom]);

  return (
    <>
      {/* 縦ズームスライダー（ナビバー直上）— 2本指操作時のみ表示し、操作終了から数秒後にフェードアウト */}
      <div
        className={`absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px)-2rem)] right-4 z-[1000] flex flex-col items-center gap-1 rounded-2xl border border-amber-100/60 bg-white/95 px-2.5 py-3 shadow-card backdrop-blur transition-opacity duration-300 ${
          zoomSliderVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!zoomSliderVisible}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { e.stopPropagation(); onZoomSliderInteract(); }}
      >
        <span className="select-none text-[12px] font-black leading-none text-amber-700 drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">+</span>
        <VerticalZoomSlider
          value={currentZoom}
          min={minZoom}
          max={maxZoom}
          onValueChange={handleZoomValueChange}
        />
        <span className="select-none text-[12px] font-black leading-none text-amber-700 drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">−</span>
      </div>

      {/* 現在地追跡ボタン（検索エリアの高さに追従） */}
      <div
        className="absolute right-4 z-[1000] transition-[top] duration-200"
        style={{ top: trackingButtonTop }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { e.stopPropagation(); }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleTracking();
          }}
          className={`flex h-11 w-11 items-center justify-center rounded-full shadow-pop transition-all active:scale-95 ${
            isTracking
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "border border-amber-100/60 bg-white/95 text-slate-600 shadow-card hover:bg-amber-50"
          }`}
          aria-label={isTracking ? "追従中" : "追従オフ"}
        >
          <Navigation className={`h-5 w-5 ${isTracking ? "fill-current" : ""}`} />
        </button>
      </div>
    </>
  );
}



/** ズームスライダー用に、連続ズーム値を自前で購読する薄いラッパー */
export function LiveZoomMapControls({
  map,
  ...rest
}: Omit<React.ComponentProps<typeof MapControls>, "currentZoom">) {
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? rest.maxZoom);
  useEffect(() => {
    if (!map) return;
    const update = () => setZoom(map.getZoom());
    update();
    map.on("zoom", update);
    map.on("zoomend", update);
    return () => {
      map.off("zoom", update);
      map.off("zoomend", update);
    };
  }, [map]);
  return <MapControls map={map} currentZoom={zoom} {...rest} />;
}

