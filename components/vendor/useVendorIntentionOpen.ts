"use client";

import { useEffect, useState } from "react";

/**
 * 出店意向調査の受付中かどうか（メニューの文字を薄くするために使う）。
 * enabled が false のとき（その導線が出ない人）は取りに行かない。
 * 取得前・取得に失敗したときは null（薄くせず、通常の文字で出す）。
 */
export function useVendorIntentionOpen(enabled: boolean): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/vendor/intention", { credentials: "same-origin" })
      .then((res) => (res.ok ? (res.json() as Promise<{ season: unknown }>) : null))
      .then((body) => {
        if (!cancelled && body) setOpen(body.season != null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return open;
}
