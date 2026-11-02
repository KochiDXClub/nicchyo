"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Tailwind の `lg`（1024px 以上）と同じ。PC・ノートPCを「広い画面」として扱う */
export const LG_MEDIA_QUERY = "(min-width: 1024px)";

/**
 * 画面が条件に合っているか。サーバーでは常に false を返し、描画後に実際の値へ切り替わる。
 * 見た目だけの切り替えは Tailwind の `lg:` で足りるので、これは
 * アニメーションの向きなど、CSS では変えられないものにだけ使う。
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      // matchMedia が無い環境（テストの jsdom など）では、変化を待たず「合わない」ままにする
      if (typeof window.matchMedia !== "function") return () => {};
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false),
    () => false
  );
}
