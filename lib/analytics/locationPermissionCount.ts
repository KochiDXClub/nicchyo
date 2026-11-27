"use client";

import { isAnalyticsOptedOut } from "@/lib/analytics/consentClient";

/**
 * 位置情報の許可・拒否の件数を数える（匿名の合計だけ）
 *
 * 送るのは「許可」か「拒否」の 1 語だけ。ID・IP・緯度経度は送らず、サーバーも保存しない。
 * 数えるのは、ブラウザの許可ダイアログに初めて答えたときだけ。
 * 起動時に「まだ聞かれていない（prompt）」だった画面で、最初の答えを 1 回だけ数える。
 * 送れなくても地図は止めない（失敗は握りつぶす）。
 * 「1 回だけ」はこの画面（クライアント）での取り決めで、乱用は API 側の回数制限で抑える。
 */

export type LocationPermissionChoice = "allowed" | "denied";

export type LocationChoiceReporter = {
  /** 起動時の許可状態を読む（ダイアログを出す前に呼ぶ） */
  readPriorState: () => Promise<void>;
  /** 許可された（最初の答えのときだけ送る） */
  onAllowed: () => void;
  /** 拒否された（最初の答えのときだけ送る） */
  onDenied: () => void;
};

async function readPermissionState(): Promise<PermissionState | null> {
  if (typeof navigator === "undefined" || typeof navigator.permissions?.query !== "function") return null;
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return null;
  }
}

function send(choice: LocationPermissionChoice): void {
  try {
    // 件数は GA4 のイベントで数える（自前の API と DB への書き込みはやめた）。
    // 送るのは許可か拒否の1語だけで、個人を特定する値は含めない。
    if (isAnalyticsOptedOut()) return;
    const w = window as Window & { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === "function") {
      w.gtag("event", "location_permission", { choice });
    }
  } catch {
    // 数えられなくても画面の動作には影響させない
  }
}

/** 同じ読み込みの中で 1 回だけ数える（地図と おでかけサポート の両方から聞いても二重に数えない） */
let answeredThisLoad = false;

export function createLocationChoiceReporter(): LocationChoiceReporter {
  let priorState: PermissionState | null = null;

  const once = (choice: LocationPermissionChoice) => {
    // 「まだ聞かれていない」画面の最初の答えだけを数える（許可済みの再訪は数えない）
    if (answeredThisLoad || priorState !== "prompt") return;
    answeredThisLoad = true;
    send(choice);
  };

  return {
    readPriorState: async () => {
      priorState = await readPermissionState();
    },
    onAllowed: () => once("allowed"),
    onDenied: () => once("denied"),
  };
}
