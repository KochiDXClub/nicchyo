"use client";

/**
 * 右側の操作部品: 縦ズームスライダーと現在地追従ボタン。
 * 地図には MapCamera（types/mapCamera.ts）経由でだけ触るので、地図ライブラリに依存しない。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Navigation, Plus } from "lucide-react";
import type { MapCamera } from "../types/mapCamera";
import { hideWhilePanningClass, useMapPanning } from "../hooks/useMapPanning";
import { cn } from "@/lib/utils/cn";
import { useMediaQuery, LG_MEDIA_QUERY } from "@/lib/hooks/useMediaQuery";

// ===== テーパー型縦ズームスライダー =====
// 上端（拡大側）が太く、下端（縮小側）が細いくさび形のトラックで操作方向を直感的に伝える。
// 地図をなるべく隠さないよう細く短くし、色は透かさずに塗る（半透明だと地図の色と混ざって読めない）
const VZ_PAD = 12;        // 上下パディング（サムがはみ出ないように）
const VZ_TRACK_H = 112;   // トラック高さ
const VZ_SVG_W = 28;
const VZ_SVG_H = VZ_TRACK_H + VZ_PAD * 2;
const VZ_WIDE = 14;       // 上端（拡大）の幅
const VZ_NARROW = 5;      // 下端（縮小）の幅
const VZ_CX = VZ_SVG_W / 2;
const VZ_L_TOP = VZ_CX - VZ_WIDE / 2;
const VZ_R_TOP = VZ_CX + VZ_WIDE / 2;
const VZ_L_BOT = VZ_CX - VZ_NARROW / 2;
const VZ_R_BOT = VZ_CX + VZ_NARROW / 2;
/** ＋／− を 1 回押したときに動かすズーム量 */
const ZOOM_STEP = 0.75;

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
  // つまんでいるあいだはサムを大きくして、指の下で掴めていることを見せる
  const [grabbing, setGrabbing] = useState(false);

  const trackTop = VZ_PAD;
  const trackBot = VZ_PAD + VZ_TRACK_H;

  const pct = Math.max(0, Math.min(1, (value - min) / (max - min))); // 0=最小, 1=最大
  const thumbY = trackTop + VZ_TRACK_H * (1 - pct); // 上=拡大, 下=縮小

  // 塗り: サムから下端まで（塗りが多い＝よりズームインしている）
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
    setGrabbing(true);
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
    setGrabbing(false);
    e.stopPropagation();
  };

  return (
    <svg
      ref={svgRef}
      width={VZ_SVG_W}
      height={VZ_SVG_H}
      className="block cursor-ns-resize touch-none overflow-visible"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="slider"
      aria-label="ズーム"
      aria-orientation="vertical"
      aria-valuenow={Math.round(value * 10) / 10}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      {/* トラック（くさび形） */}
      <polygon points={trackPts} className="fill-nicchyo-ink/10" />
      {/* 塗り（現在のズームレベルを表す） */}
      <polygon points={fillPts} className="fill-amber-500" />
      {/* サム */}
      <circle
        cx={VZ_CX}
        cy={thumbY}
        r={grabbing ? 10 : 8}
        strokeWidth={2.5}
        className="fill-white stroke-amber-500 drop-shadow-[0_1px_2px_rgba(58,58,58,0.25)] transition-[r] duration-150 ease-out-soft motion-reduce:transition-none"
      />
    </svg>
  );
}

/** スライダーの上下に置く ＋／− ボタン。指で押せる大きさ（幅 44px）を確保する */
function ZoomStepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-10 w-11 items-center justify-center text-amber-700 transition-colors hover:bg-amber-50 active:bg-amber-100 disabled:text-nicchyo-ink/25 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
    >
      {children}
    </button>
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
  // 地図をドラッグしているあいだは、上に浮いている検索バーなどと一緒に現在地ボタンも隠す
  const isPanning = useMapPanning(map);
  const isDesktop = useMediaQuery(LG_MEDIA_QUERY);
  const sliderShown = isDesktop || zoomSliderVisible;

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

  const handleZoomStep = useCallback((direction: 1 | -1) => {
    if (!map) return;
    onZoomSliderInteract();
    const nextZoom = Math.max(minZoom, Math.min(maxZoom, map.getZoom() + direction * ZOOM_STEP));
    map.setZoom(nextZoom);
  }, [map, maxZoom, minZoom, onZoomSliderInteract]);

  useEffect(() => {
    return () => {
      if (zoomFrameRef.current !== null) {
        window.cancelAnimationFrame(zoomFrameRef.current);
      }
    };
  }, [flushZoom]);

  return (
    <>
      {/* 縦ズームスライダー（ナビバー直上）— スマホは2本指操作時のみ表示し、操作終了から数秒後にフェードアウト。PC は常時表示 */}
      <div
        className={cn(
          "absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px)-2rem)] right-4 z-[1000] flex flex-col items-center overflow-hidden rounded-chip bg-white shadow-float ring-1 ring-line transition-[opacity,transform] duration-300 ease-out-soft motion-reduce:transform-none",
          sliderShown ? "opacity-100" : "pointer-events-none translate-x-2 opacity-0"
        )}
        aria-hidden={!sliderShown}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { e.stopPropagation(); onZoomSliderInteract(); }}
      >
        <ZoomStepButton label="拡大" disabled={currentZoom >= maxZoom - 0.01} onClick={() => handleZoomStep(1)}>
          <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden />
        </ZoomStepButton>
        <VerticalZoomSlider
          value={currentZoom}
          min={minZoom}
          max={maxZoom}
          onValueChange={handleZoomValueChange}
        />
        <ZoomStepButton label="縮小" disabled={currentZoom <= minZoom + 0.01} onClick={() => handleZoomStep(-1)}>
          <Minus className="h-4 w-4" strokeWidth={2.6} aria-hidden />
        </ZoomStepButton>
      </div>

      {/* 現在地追跡ボタン（検索エリアの高さに追従） */}
      <div
        // lg 以上は検索が左上のパネルになり、その高さに追従させる必要がない。
        // 右上には相談・近況・メニューのツールバーが入るので、その真下（lg:top-20）に置く。
        // top は inline style なので !important で上書きする
        className={cn("absolute right-4 z-[1000] transition-[top] duration-200 lg:!top-20", isPanning && "pointer-events-none")}
        style={{ top: trackingButtonTop }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { e.stopPropagation(); }}
      >
        {/* 位置（top）の動きと、パン中に隠す動き（opacity・transform）は transition が別なので要素を分ける */}
        <div className={hideWhilePanningClass(isPanning)}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleTracking();
            }}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-chip transition-all active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
              isTracking
                ? "bg-amber-500 text-white shadow-pop hover:bg-amber-600"
                : "bg-white text-nicchyo-ink/70 shadow-float ring-1 ring-line hover:bg-amber-50"
            )}
            aria-label="現在地に追従する"
            aria-pressed={isTracking}
          >
            <Navigation className={`h-5 w-5 ${isTracking ? "fill-current" : ""}`} />
          </button>
        </div>
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

