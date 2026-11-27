"use client";

import { useMemo } from "react";
import MarketMonthCalendar from "@/app/components/market/MarketMonthCalendar";
import type { MarketEvent } from "@/app/api/admin/events/route";
import { toPublicEvent } from "./EventRow";

type Props = {
  events: MarketEvent[];
  days: { market_date: string; status: string }[];
  /** 日を開いて、その日曜の一覧カードを開きにいく */
  onOpenDay: (dateIso: string) => void;
};

/**
 * 運営の画面で使う月カレンダー。見た目は来訪者向けと同じ共通部品で、
 * 運営だけ「公開中・非公開」の印と「この日のカードを開く」ボタンを足す。
 */
export default function AdminMonthCalendar({ events, days, onOpenDay }: Props) {
  const monthEvents = useMemo(
    () => events.map((event) => ({ ...toPublicEvent(event), is_published: event.is_published })),
    [events]
  );
  return (
    <MarketMonthCalendar
      events={monthEvents}
      days={days}
      onOpenDay={onOpenDay}
      renderEventStatus={(event) => (
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${
            event.is_published ? "bg-green-100 text-green-800" : "bg-nicchyo-ink/5 text-nicchyo-ink/70"
          }`}
        >
          {event.is_published ? "公開中" : "非公開"}
        </span>
      )}
    />
  );
}
