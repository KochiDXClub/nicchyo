"use client";

import { useEffect, useState } from "react";
import { isEquirectangularPhoto } from "./panorama";

/**
 * 画像を読み込んで、全周写真かを調べる。src が無いときは false。
 *
 * バナーの小さなサムネイル（400px ほど）で調べるために使う。全周写真は
 * 元の写真と同じ 2:1 のまま縮小されるので、重い本体を読まなくても見分けがつく。
 * 本体は、来訪者がタップして拡大表示を開いたときに初めて読む。
 */
export function usePanoramaProbe(src?: string | null): boolean {
  const [isPanorama, setIsPanorama] = useState(false);

  useEffect(() => {
    setIsPanorama(false);
    if (!src) return;
    let cancelled = false;
    const probe = new window.Image();
    probe.onload = () => {
      if (!cancelled) setIsPanorama(isEquirectangularPhoto(probe.naturalWidth, probe.naturalHeight));
    };
    probe.src = src;
    return () => {
      cancelled = true;
      probe.onload = null;
    };
  }, [src]);

  return isPanorama;
}
