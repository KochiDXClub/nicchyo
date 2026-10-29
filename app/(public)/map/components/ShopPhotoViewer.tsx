"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X as XIcon } from "lucide-react";
import type { ShopImageKind } from "@/lib/shopImages";
import { PanoramaView } from "./PanoramaView";

export type ShopPhoto = {
  src: string;
  alt: string;
  /** 写真の下に出す一行（商品名と値段など） */
  caption?: string;
  /** 写真の種類。panorama（全周カメラの写真）はドラッグで見渡せる。未設定は普通の写真 */
  kind?: ShopImageKind;
};

/**
 * 1枚ぶんの表示。登録のときに全周写真（kind が panorama）とされた写真は、ドラッグで見渡せる表示にする。
 * 普通の写真は、枠に収めて見せる。
 */
function PhotoSlide({ photo, priority }: { photo: ShopPhoto; priority: boolean }) {
  if (photo.kind === "panorama") {
    return (
      <>
        <PanoramaView src={photo.src} alt={photo.alt} />
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-chip bg-black/50 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
          360° ドラッグで見渡せます
        </p>
      </>
    );
  }
  return (
    <Image
      src={photo.src}
      alt={photo.alt}
      fill
      sizes="100vw"
      className="object-contain"
      priority={priority}
    />
  );
}

/**
 * 店の写真と商品の写真を、画面いっぱいに大きく見せる。
 *
 * 来訪者は写真を見て行くかどうかを決めるので、バナーの写真はどれもタップでここに来られる。
 * 左右にスワイプ（PC は矢印キーとボタン）で、その店のほかの写真に移れる。
 *
 * バナーのシートは transform で動かしているので、その中に fixed で置くとシートの枠に閉じ込められる。
 * body に portal で出す。
 */
export function ShopPhotoViewer({
  photos,
  initialIndex,
  onClose,
}: {
  photos: ShopPhoto[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // 開いた写真の位置から始める（スクロールのアニメーションは付けない）
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = initialIndex * scroller.clientWidth;
  }, [initialIndex]);

  // 開いたら「閉じる」に focus を移し、閉じたら（この部品が外れたら）押した写真のボタンに戻す
  useLayoutEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  const goTo = useCallback((next: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const clamped = Math.max(0, Math.min(photos.length - 1, next));
    scroller.scrollTo({ left: clamped * scroller.clientWidth, behavior: "smooth" });
  }, [photos.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goTo(index - 1);
      if (event.key === "ArrowRight") goTo(index + 1);
      if (event.key === "Tab") {
        // 裏のバナーに focus が抜けないよう、拡大表示の中のボタンだけを回す。
        // 「前の写真」「次の写真」はモバイルでは隠れている（display: none）ので数えない
        const buttons = Array.from(
          dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []
        ).filter((button) => window.getComputedStyle(button).display !== "none");
        if (buttons.length === 0) return;
        event.preventDefault();
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.shiftKey
          ? current <= 0 ? buttons.length - 1 : current - 1
          : (current + 1) % buttons.length;
        buttons[next].focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, index, onClose]);

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    setIndex(Math.round(scroller.scrollLeft / scroller.clientWidth));
  };

  if (typeof document === "undefined" || photos.length === 0) return null;
  const current = photos[Math.min(index, photos.length - 1)];
  // 全周写真の上では横スワイプで写真を切り替えられないので、そのあいだはスマホでも矢印ボタンを出す
  const arrowVisibility = current?.kind === "panorama" ? "flex" : "hidden md:flex";

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="写真の拡大表示"
      className="fixed inset-0 z-[2100] flex flex-col bg-black text-white"
      style={{ paddingTop: "var(--safe-top, 0px)", paddingBottom: "var(--safe-bottom, 0px)" }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <p className="text-sm font-semibold tabular-nums text-white/70">
          {photos.length > 1 ? `${index + 1} / ${photos.length}` : ""}
        </p>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
        >
          <XIcon className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-contain"
          style={{ scrollbarWidth: "none" }}
        >
          {photos.map((photo, i) => (
            // 写真を押しても閉じない（見ている途中に指が触れて閉じるのを防ぐ）。閉じるのは右上のボタンか Esc
            <div key={`${photo.src}-${i}`} className="relative h-full w-full shrink-0 snap-center">
              <PhotoSlide photo={photo} priority={i === initialIndex} />
            </div>
          ))}
        </div>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label="前の写真"
              className={`absolute left-3 top-1/2 ${arrowVisibility} z-10 h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-0`}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === photos.length - 1}
              aria-label="次の写真"
              className={`absolute right-3 top-1/2 ${arrowVisibility} z-10 h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-0`}
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        )}
      </div>

      <div className="flex min-h-16 shrink-0 items-center justify-center px-5 py-3">
        {current?.caption && (
          <p className="text-center text-[15px] font-semibold leading-snug">{current.caption}</p>
        )}
      </div>
    </div>,
    document.body
  );
}
