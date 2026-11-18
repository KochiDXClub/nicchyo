"use client";

import { useEffect, useState } from "react";
import {
  normalizeCategory,
  normalizeHighlightDates,
  normalizeStatus,
  type MarketCalendar,
  type MarketDay,
} from "./calendar";

/**
 * 公開カレンダー（開催ステータス＋今日以降のイベント）をクライアントから取得する。
 * 取得できなかった場合は error で呼び出し側に知らせる。
 */
export function useMarketCalendar(): { calendar: MarketCalendar; loading: boolean; error: boolean } {
  const [calendar, setCalendar] = useState<MarketCalendar>({
    day: null,
    days: [],
    events: [],
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
        if (!data || typeof data !== "object" || !Array.isArray(data.days) || !Array.isArray(data.events)) throw new Error("開催情報の形式が正しくありません");
        const days: MarketDay[] = Array.isArray(data.days)
          ? data.days.map((d: MarketDay) => ({ ...d, status: normalizeStatus(d.status) }))
          : [];
        setCalendar({
          day: data.day
            ? { ...data.day, status: normalizeStatus(data.day.status) }
            : null,
          days,
          events: Array.isArray(data.events)
            ? data.events.map((e: { category: unknown; highlight_dates: unknown }) => ({
                ...e,
                category: normalizeCategory(e.category),
                highlight_dates: normalizeHighlightDates(e.highlight_dates),
              }))
            : [],
        });
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
