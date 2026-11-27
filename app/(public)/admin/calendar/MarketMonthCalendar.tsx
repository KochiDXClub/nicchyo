"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatEventDate,
  formatEventPeriod,
  formatEventTime,
  getCategoryPresentation,
  getStatusPresentation,
  getUpcomingSundayIso,
  toIsoDate,
  type MarketDayStatus,
  type MarketEvent as PublicMarketEvent,
} from "@/lib/market/calendar";
import {
  buildMonthGrid,
  getMonthDayInfo,
  shiftMonth,
  type MonthDayTone,
} from "@/lib/market/monthCalendar";
import type { MarketEvent } from "@/app/api/admin/events/route";
import { toPublicEvent } from "./EventRow";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** 開催日の色。平常は淡い緑、中止・休市は赤、特別開催は黄のアクセント */
const TONE_CLASS: Record<MonthDayTone, string> = {
  none: "",
  open: "bg-nicchyo-soft-green/35 text-nicchyo-ink",
  alert: "bg-rose-500 text-white",
  highlight: "bg-nicchyo-accent text-nicchyo-ink",
};

type Props = {
  events: MarketEvent[];
  days: { market_date: string; status: string }[];
  /** 日を開いて、その日曜の一覧カードを開きにいく */
  onOpenDay: (dateIso: string) => void;
};

/**
 * 運営の日曜市カレンダーの月表示。
 * 開催日（日曜）を色で示し、中止・休市は赤で塗る。予定がある日は件数を文字で出し、
 * タップするとその日の予定を下に出す（編集は一覧カードで行う）。
 */
export default function MarketMonthCalendar({ events, days, onOpenDay }: Props) {
  const todayIso = toIsoDate(new Date());
  const initial = getUpcomingSundayIso().slice(0, 7);
  const [viewYear, setViewYear] = useState(Number(initial.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(initial.slice(5, 7)));
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const publicEvents = useMemo(() => events.map(toPublicEvent), [events]);
  const weeks = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const shift = (delta: number) => {
    const next = shiftMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  };

  const selectedInfo = selectedIso ? getMonthDayInfo(selectedIso, publicEvents, days) : null;
  const selectedEvents = selectedInfo
    ? events.filter((event) => selectedInfo.events.some((e) => e.id === event.id))
    : [];

  return (
    <section aria-label="月カレンダー" className="mb-4 rounded-btn border border-line bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="前の月"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-nicchyo-ink/70 hover:bg-nicchyo-ink/5"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <p className="text-base font-bold text-nicchyo-ink">
          {viewYear}年{viewMonth}月
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="次の月"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-nicchyo-ink/70 hover:bg-nicchyo-ink/5"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-semibold text-nicchyo-ink/60">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={`py-1 ${i === 0 ? "text-rose-600" : ""}`}>
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-line">
        {weeks.flat().map((cell) => {
          if (!cell.inMonth) {
            return <span key={cell.dateIso} className="min-h-14 bg-white" aria-hidden />;
          }
          const info = getMonthDayInfo(cell.dateIso, publicEvents, days);
          const count = info.events.length;
          const isToday = cell.dateIso === todayIso;
          const isSelected = cell.dateIso === selectedIso;
          const status: MarketDayStatus | null = info.status;
          const base = `flex min-h-14 flex-col items-center gap-0.5 px-0.5 py-1 text-[13px] ${
            cell.isMarketDay ? TONE_CLASS[info.tone] : "bg-white text-nicchyo-ink/45"
          }`;
          const content = (
            <>
              <span className={`font-bold ${isToday ? "underline underline-offset-2" : ""}`}>{cell.day}</span>
              {cell.isMarketDay && status && status !== "open" && (
                <span className="text-[10px] font-semibold leading-tight">{getStatusPresentation(status).label}</span>
              )}
              {count > 0 && (
                <span className="rounded-full bg-white/90 px-1 text-[10px] font-bold leading-tight text-nicchyo-ink">
                  予定{count}
                </span>
              )}
            </>
          );

          if (!cell.isMarketDay) {
            return (
              <span key={cell.dateIso} className={base}>
                {content}
              </span>
            );
          }

          const label = [
            formatEventDate(cell.dateIso),
            status ? getStatusPresentation(status).label : null,
            count > 0 ? `予定${count}件` : null,
          ]
            .filter(Boolean)
            .join("、");

          return (
            <button
              key={cell.dateIso}
              type="button"
              aria-label={label}
              aria-pressed={isSelected}
              onClick={() => setSelectedIso(cell.dateIso)}
              className={`${base} ${isSelected ? "ring-2 ring-inset ring-nicchyo-ink" : ""} focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500`}
            >
              {content}
            </button>
          );
        })}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-nicchyo-ink/70">
        <li className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-nicchyo-soft-green/35 ring-1 ring-line" aria-hidden />
          開催
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-rose-500" aria-hidden />
          中止・休市
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-nicchyo-accent" aria-hidden />
          特別開催
        </li>
        <li>予定1件以上の日は件数を表示</li>
      </ul>

      {selectedInfo && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-nicchyo-ink">
              {formatEventDate(selectedInfo.dateIso)}
              {selectedInfo.status && (
                <span className="ml-2 text-xs font-semibold text-nicchyo-ink/70">
                  {getStatusPresentation(selectedInfo.status).label}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => onOpenDay(selectedInfo.dateIso)}
              className="rounded-lg bg-nicchyo-ink/5 px-3 py-1.5 text-xs font-semibold text-nicchyo-ink hover:bg-nicchyo-ink/10"
            >
              この日のカードを開く
            </button>
          </div>

          {selectedEvents.length === 0 ? (
            <p className="mt-2 text-sm text-nicchyo-ink/55">予定はありません</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {selectedEvents.map((event) => (
                <DayEventItem key={event.id} event={event} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function DayEventItem({ event }: { event: MarketEvent }) {
  const publicEvent: PublicMarketEvent = toPublicEvent(event);
  const { label, emoji } = getCategoryPresentation(publicEvent.category);
  const time = formatEventTime(event.start_time, event.end_time);
  const period = formatEventPeriod(publicEvent);
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${
            event.is_published ? "bg-green-100 text-green-800" : "bg-nicchyo-ink/5 text-nicchyo-ink/70"
          }`}
        >
          {event.is_published ? "公開中" : "非公開"}
        </span>
        <span className="rounded-full bg-nicchyo-ink/5 px-2 py-0.5 font-semibold text-nicchyo-ink/70">
          {emoji} {label}
        </span>
      </div>
      <p className="mt-1 font-semibold text-nicchyo-ink">{event.title}</p>
      <p className="mt-0.5 text-xs text-nicchyo-ink/60">
        {[period, time, event.location].filter(Boolean).join(" · ")}
      </p>
    </li>
  );
}
