"use client";

import { useEffect, useState } from "react";

import { useMapLoading } from "@/app/components/MapLoadingProvider";

/** ローディングが畳まれてから、位置情報を聞くまでの間 */
export const LOCATION_PROMPT_DELAY_MS = 3000;

/**
 * すでに位置情報を許可しているか
 *
 * 分からない場合（Permissions API が無い・geolocation を照会できない）は false を返し、
 * 待ってから聞く側に倒す。
 */
async function isGeolocationAlreadyGranted(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return false;
  try {
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state === "granted";
  } catch {
    // 名前を扱えないブラウザでは例外になる
    return false;
  }
}

/**
 * 位置情報をいつ聞き始めてよいかを返す
 *
 * ブラウザの位置情報ダイアログは、読み込み中に出すと
 * 「何も操作していないのに突然出てきた」ように見えるうえ、
 * ローディング画面の上に重なって何を聞かれているのか分からない。
 *
 * そこで、地図が出そろってローディングが畳まれてから少し待って聞く。
 * ただし、すでに許可している方にはダイアログが出ないので待つ理由がない。
 * その場合は畳まれ次第すぐ取りにいき、現在地の表示を遅らせない。
 *
 * 一度開けたら閉じない（画面遷移の途中で status が変わっても取得は止めない）。
 */
export function useLocationPermissionGate(delayMs: number = LOCATION_PROMPT_DELAY_MS): boolean {
  const { status } = useMapLoading();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    // status が idle ＝ ローディングの覆いが畳み終わっている
    if (status !== "idle") return;

    let cancelled = false;
    let timer: number | undefined;

    void isGeolocationAlreadyGranted().then((granted) => {
      if (cancelled) return;
      if (granted) {
        setReady(true);
        return;
      }
      timer = window.setTimeout(() => setReady(true), delayMs);
    });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [status, delayMs, ready]);

  return ready;
}
