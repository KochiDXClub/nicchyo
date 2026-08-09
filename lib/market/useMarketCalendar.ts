"use client";

import { useEffect, useState } from "react";
import { normalizeStatus, type MarketCalendar } from "./calendar";

/**
 * 公開カレンダー（開催ステータス＋今日以降のイベント）をクライアントから取得する。
 * 失敗しても呼び出し側の表示を壊さないよう、空のカレンダーに倒す。
 */
export function useMarketCalendar(): { calendar: MarketCalendar; loading: boolean } {
  const [calendar, setCalendar] = useState<MarketCalendar>({ day: null, events: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market-calendar")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || typeof data !== "object") return;
        setCalendar({
          day: data.day
            ? { ...data.day, status: normalizeStatus(data.day.status) }
            : null,
          events: Array.isArray(data.events) ? data.events : [],
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { calendar, loading };
}
