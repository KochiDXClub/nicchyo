"use client";

import { useEffect, useState } from "react";
import type { MarketCalendar } from "./calendar";

/**
 * 公開カレンダー（開催ステータス＋今日以降のイベント）をクライアントから取得する。
 * 取得できなかった場合は error で呼び出し側に知らせる。
 */
export function useMarketCalendar(): { calendar: MarketCalendar; loading: boolean; error: boolean } {
  const [calendar, setCalendar] = useState<MarketCalendar>({
    todayIso: "",
    markets: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market-calendar")
      .then((r) => {
        if (!r.ok) throw new Error("開催情報を取得できませんでした");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (typeof data?.todayIso !== "string" || !Array.isArray(data.markets)) {
          throw new Error("開催情報の形式が正しくありません");
        }
        setCalendar(data);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { calendar, loading, error };
}
