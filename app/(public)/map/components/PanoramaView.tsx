"use client";

import dynamic from "next/dynamic";
import Image, { getImageProps } from "next/image";
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import type { Viewer } from "@photo-sphere-viewer/core";

/** 矢印キーで1回に回す量（ラジアン。約6°） */
const KEY_STEP = 0.1;

/**
 * 重い（three.js を含む）ので、全周写真を開いたときだけ読み込む。
 * 読み込んでいるあいだは、黒い背景のまま。
 */
const PanoramaSphere = dynamic(() => import("./PanoramaSphere"), { ssr: false });

/**
 * 全周写真を、球の内側から見渡す（指・マウスのドラッグ、ピンチ・ホイールで拡大縮小）。
 *
 * 見渡す表示は Photo Sphere Viewer（PanoramaSphere）が担う。この部品は、その外側の枠として
 * 読み上げの名前と、キーボード操作（フォーカスして矢印キー）を受け持つ。
 * 横スワイプで写真を切り替える親（ShopPhotoViewer）と取り合わないよう、
 * この部品の上では touch-action: none でブラウザのスクロールを止める。
 */
export function PanoramaView({ src, alt }: { src: string; alt: string }) {
  // 元の画像は数 MB になりやすいので、next/image が作る縮小版（WebP）を読む。同じ配信元なので画像の読み込みに CORS も要らない
  const { props: imageProps } = getImageProps({ src, alt: "", width: 1920, height: 960 });
  const viewerRef = useRef<Viewer | null>(null);
  // 球体の表示を始められない端末（WebGL が使えないなど）では、普通の写真として見せる
  const [failed, setFailed] = useState(false);
  const handleError = useCallback(() => setFailed(true), []);
  const handleReady = useCallback((viewer: Viewer | null) => {
    viewerRef.current = viewer;
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const viewer = viewerRef.current;
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    };
    const delta = move[event.key];
    if (!delta) return;
    // preventDefault で、外側の横スクロール（写真の切り替え）が矢印キーで動くのを止める。stopPropagation は、写真の切り替えのキー処理に渡さないため
    event.preventDefault();
    event.stopPropagation();
    if (!viewer) return;
    const { yaw, pitch } = viewer.getPosition();
    viewer.rotate({ yaw: yaw + delta[0], pitch: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch + delta[1])) });
  };

  if (failed) {
    return <Image src={src} alt={alt} fill sizes="100vw" className="object-contain" />;
  }

  return (
    <div
      role="application"
      aria-label={`${alt}（360度。ドラッグして見渡せます）`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="absolute inset-0 select-none bg-black"
      style={{ touchAction: "none" }}
    >
      <PanoramaSphere src={imageProps.src} onReady={handleReady} onError={handleError} />
    </div>
  );
}
