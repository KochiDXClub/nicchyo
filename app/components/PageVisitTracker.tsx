"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  ANALYTICS_OPT_OUT_CHANGE_EVENT,
  isAnalyticsOptedOut,
  loadGA,
} from "@/lib/analytics/consentClient";

function sendVisit(path: string, durationSeconds: number) {
  if (isAnalyticsOptedOut()) return;
  const payload = JSON.stringify({ path, durationSeconds });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/page-visit", blob);
    return;
  }

  void fetch("/api/analytics/page-visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

export default function PageVisitTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathRef = useRef("");
  const startTimeRef = useRef<number>(Date.now());
  const sentRef = useRef(false);

  const flush = (markComplete: boolean) => {
    if (!pathRef.current || (markComplete && sentRef.current)) return;
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    if (durationSeconds <= 0) return;
    sendVisit(pathRef.current, durationSeconds);
    startTimeRef.current = Date.now();
    if (markComplete) {
      sentRef.current = true;
    }
  };

  // 以前は同意バナーが GA を読み込んでいた。バナーを廃止したのでここで読み込む。
  // 停止・再開はその場で効かせたいので、切り替えを購読して読み直す
  // （loadGA が ga-disable も揃えるため、止めているときは読み込まず指示だけ出す）
  useEffect(() => {
    const sync = () => {
      if (process.env.NODE_ENV === "production") loadGA();
    };
    sync();
    window.addEventListener(ANALYTICS_OPT_OUT_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ANALYTICS_OPT_OUT_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const search = searchParams?.toString();
    const nextPath = search ? `${pathname}?${search}` : pathname;

    if (pathRef.current) {
      flush(false);
    }

    pathRef.current = nextPath;
    startTimeRef.current = Date.now();
    sentRef.current = false;
    sendVisit(nextPath, 1);

    // 画面遷移ぶんの GA4 page_view。止めている端末では送らない
    if (isAnalyticsOptedOut()) return;
    try {
      const w = window as Window & { gtag?: (...args: unknown[]) => void };
      if (typeof w?.gtag === "function") {
        w.gtag("event", "page_view", { page_path: nextPath });
      }
    } catch {
      // ignore in non-browser environments
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush(true);
      }
    };
    const handlePageHide = () => {
      flush(true);
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        flush(false);
      }
    }, 15000);

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      flush(true);
      window.clearInterval(intervalId);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
