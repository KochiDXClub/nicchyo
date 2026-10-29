"use client";

import { useRef } from "react";
import { PANORAMA_THUMB_WIDTH_RATIO, normalizePanoramaCenter } from "@/lib/image/panoramaThumb";
import { cn } from "@/lib/utils/cn";

/** 矢印キーで動かす幅（写真の横幅に対する割合） */
const KEY_STEP = 0.02;

/**
 * 全周写真のどの部分を、バナーのサムネイルにするかを選ぶ。
 * 全周写真を丸ごと見せ、サムネイルになる枠（高さは中央で固定）を左右に動かして決める。
 * 全周は左右がつながっているので、枠は端をまたげる。
 * 出店者の写真登録と、運営の現地登録で同じものを使う。
 */
export function PanoramaThumbPicker({
  src,
  value,
  onChange,
  disabled = false,
  className,
}: {
  /** 全周写真の URL（選んだ写真の blob URL でも、登録済みの写真の URL でもよい） */
  src: string;
  /** 切り出しの中心。写真の横幅に対する割合（0〜1） */
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const center = normalizePanoramaCenter(value);

  const moveTo = (clientX: number) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    onChange(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)));
  };

  // 端をまたぐ枠は、左右に1つずつ描き足す（はみ出した分は枠の外に切れて、反対側に現れる）
  const frameLefts = [-1, 0, 1].map((shift) => (center - PANORAMA_THUMB_WIDTH_RATIO / 2 + shift) * 100);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        ref={areaRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="サムネイルにする部分"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(center * 100)}
        aria-disabled={disabled}
        onPointerDown={(event) => {
          if (disabled) return;
          draggingRef.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          moveTo(event.clientX);
        }}
        onPointerMove={(event) => {
          if (draggingRef.current) moveTo(event.clientX);
        }}
        onPointerUp={() => {
          draggingRef.current = false;
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onChange(center - KEY_STEP);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            onChange(center + KEY_STEP);
          }
        }}
        // 横のドラッグは枠を動かすのに使い、縦のスクロールは画面に任せる
        style={{ touchAction: "pan-y" }}
        className={cn(
          "relative aspect-[2/1] w-full select-none overflow-hidden rounded-card bg-nicchyo-base ring-1 ring-line",
          disabled ? "opacity-60" : "cursor-ew-resize"
        )}
      >
        {/* 選んだ写真の blob URL も出すので、next/image ではなく img を使う */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        {frameLefts.map((left, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="pointer-events-none absolute rounded-sm border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.45)]"
            style={{
              left: `${left}%`,
              width: `${PANORAMA_THUMB_WIDTH_RATIO * 100}%`,
              // 高さは中央で固定（切り出しは4:3、全周写真は2:1なので縦の3/8）
              top: "31.25%",
              height: "37.5%",
            }}
          />
        ))}
      </div>
      <p className="text-xs text-nicchyo-ink/55">
        枠の部分が、バナーとマップに出る写真になります。写真の上をなぞって、出したい場所に動かしてください。
      </p>
    </div>
  );
}
