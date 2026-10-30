"use client";

import { getImageProps } from "next/image";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/** 矢印キーで1回に回す量（px） */
const KEY_STEP = 60;

/**
 * 全周写真を、指（PC はマウス）のドラッグでぐるっと見渡す。
 *
 * 画像を表示の高さに合わせ、横に繰り返して並べる。左右にドラッグすると端がつながって
 * 何周でも回れる。縦は全周写真の高さがそのまま画面に収まるので動かさない。
 * 横スワイプで写真を切り替える親（ShopPhotoViewer）と取り合わないよう、
 * この部品の上では touch-action: none でブラウザのスクロールを止める。
 */
export function PanoramaView({ src, alt }: { src: string; alt: string }) {
  // 元の画像は数 MB になりやすいので、next/image が作る縮小版（WebP）を背景に使う
  const { props: imageProps } = getImageProps({ src, alt: "", width: 1920, height: 960 });
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const lastXRef = useRef<number | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    lastXRef.current = event.clientX;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (lastXRef.current === null) return;
    const dx = event.clientX - lastXRef.current;
    lastXRef.current = event.clientX;
    setOffset((current) => current + dx);
  };

  const endDrag = () => {
    lastXRef.current = null;
    setDragging(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // preventDefault で、外側の横スクロール（写真の切り替え）が矢印キーで動くのを止める。stopPropagation は、写真の切り替えのキー処理に渡さないため
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      setOffset((current) => current + KEY_STEP);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      setOffset((current) => current - KEY_STEP);
    }
  };

  return (
    <div
      role="application"
      aria-label={`${alt}（360度。ドラッグして見渡せます）`}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className={`absolute inset-0 select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        touchAction: "none",
        backgroundImage: `url("${imageProps.src}")`,
        backgroundRepeat: "repeat-x",
        backgroundSize: "auto 100%",
        backgroundPosition: `${offset}px center`,
      }}
    />
  );
}
