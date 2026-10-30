"use client";

import { useEffect, useRef } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";

/** 最初に見える横の画角（度）。広すぎると遠近が薄れ、狭すぎると何が写っているか分からない */
const DEFAULT_FOV = 80;
const MIN_FOV = 30;
const MAX_FOV = 100;

/**
 * 全周写真（横:縦 = 2:1 の正距円筒図法）を、球の内側に貼って見渡す。Photo Sphere Viewer を使う。
 * 重い（three.js を含む）ので、拡大表示で全周写真を開いたときだけ読み込む（PanoramaView が dynamic import する）。
 * 見渡す操作（ドラッグ・ピンチ・ホイール）は Photo Sphere Viewer に任せ、キー操作は PanoramaView が受けて onReady の viewer を回す。
 */
export default function PanoramaSphere({ src, onReady }: { src: string; onReady: (viewer: Viewer | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // onReady は最新のものを呼ぶが、変わったからといって viewer は作り直さない
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const viewer = new Viewer({
      container,
      panorama: src,
      // 操作は写真の上のドラッグだけで足りる。ボタンの列は出さない
      navbar: false,
      keyboard: false,
      loadingTxt: "",
      minFov: MIN_FOV,
      maxFov: MAX_FOV,
      // zoom レベル（0〜100）は maxFov から minFov へ直線で進む
      defaultZoomLvl: ((MAX_FOV - DEFAULT_FOV) / (MAX_FOV - MIN_FOV)) * 100,
      mousewheelCtrlKey: false,
      touchmoveTwoFingers: false,
    });
    onReadyRef.current(viewer);
    return () => {
      onReadyRef.current(null);
      viewer.destroy();
    };
  }, [src]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
