"use client";

import { useEffect, useState } from "react";

import { useMapLoading } from "@/app/components/MapLoadingProvider";

/** ローディングが畳まれてから、位置情報を聞くまでの間 */
export const LOCATION_PROMPT_DELAY_MS = 3000;

/**
 * 位置情報をいつ聞き始めてよいかを返す
 *
 * ブラウザの位置情報ダイアログは、読み込み中に出すと
 * 「何も操作していないのに突然出てきた」ように見えるうえ、
 * ローディング画面の上に重なって何を聞かれているのか分からない。
 *
 * そこで、地図が出そろってローディングが畳まれてから少し待って聞く。
 * 一度開けたら閉じない（画面遷移の途中で status が変わっても取得は止めない）。
 */
export function useLocationPermissionGate(delayMs: number = LOCATION_PROMPT_DELAY_MS): boolean {
  const { status } = useMapLoading();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    // status が idle ＝ ローディングの覆いが畳み終わっている
    if (status !== "idle") return;
    const timer = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [status, delayMs, ready]);

  return ready;
}
