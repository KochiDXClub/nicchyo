"use client";

import { useEffect, useState } from "react";
import { readImageSize } from "@/lib/image/clientCompression";
import { isEquirectangularPhoto } from "@/lib/image/panorama";
import type { ShopImageKind } from "@/lib/shopImages";

/**
 * 選んだ店舗写真の種類（普通／全周）の状態。
 *
 * 写真を選ぶと比率を調べ、2:1 なら全周写真を初期値にする（変えられる）。
 * 2:1 でない写真は全周として見せられないので、全周は選べない（panoramaAvailable が false）。
 * 比率を調べているあいだ（checking）は登録させない。
 */
export function useShopImageKind(file: File | null) {
  const [kind, setKind] = useState<ShopImageKind>("normal");
  const [panoramaAvailable, setPanoramaAvailable] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setKind("normal");
    setPanoramaAvailable(true);
    if (!file) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    void readImageSize(file).then((size) => {
      if (cancelled) return;
      const wide = !!size && isEquirectangularPhoto(size.width, size.height);
      setPanoramaAvailable(wide);
      setKind(wide ? "panorama" : "normal");
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  return { kind, setKind, panoramaAvailable, checking };
}
