"use client";

import { useEffect, useState } from "react";
import { normalizeCategory, normalizeStatus, type MarketCalendar, type MarketDay } from "./calendar";

/**
 * 公開カレンダー（開催ステータス＋今日以降のイベント）をクライアントから取得する。
 * 失敗しても呼び出し側の表示を壊さないよう、空のカレンダーに倒す。
 */
export function useMarketCalendar(): { calendar: MarketCalendar; loading: boolean } {
  const [calendar, setCalendar] = useState<MarketCalendar>({
    day: null,
    days: [],
    events: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market-calendar")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || typeof data !== "object") return;
        const days: MarketDay[] = Array.isArray(data.days)
          ? data.days.map((d: MarketDay) => ({ ...d, status: normalizeStatus(d.status) }))
          : [];
        setCalendar({
          day: data.day
            ? { ...data.day, status: normalizeStatus(data.day.status) }
            : null,
          days,
          events: Array.isArray(data.events)
            ? data.events.map((e: { category: unknown }) => ({
                ...e,
                category: normalizeCategory(e.category),
              }))
            : [],
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
