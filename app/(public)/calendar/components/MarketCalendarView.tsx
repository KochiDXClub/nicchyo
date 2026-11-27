"use client";

import { useMemo, useState, type ReactNode } from "react";
import MarketStatusCalendar from "@/app/components/market/MarketStatusCalendar";
import UpcomingMarketDates from "@/app/components/market/UpcomingMarketDates";
import { PageContainer } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import MarketMonthCalendar from "@/app/components/market/MarketMonthCalendar";
import type { MarketCalendarDate, MarketDay, MarketEvent } from "@/lib/market/calendar";
import { filterDatesByMarket, findNextMarketDate, listMarketOptions } from "../marketFilter";

type Props = {
  /** ページの見出し（緑の帯の中、チップの上に置く） */
  heading: ReactNode;
  dates: MarketCalendarDate[];
  /** 帯の中、一覧の前に出す案内（取得の失敗など） */
  notice?: ReactNode;
  /** 日曜市の月カレンダー。日曜市が見えているときだけ出す */
  monthCalendar?: {
    marketId: string;
    events: MarketEvent[];
    days: MarketDay[];
    knownRange: { from: string; to: string };
  } | null;
};

/**
 * 市の開催カレンダーの本体。
 *
 * 来訪者が知りたいのは「どの市が・いつ・いつもどおり開くか」。複数の市が並んでも迷わないよう、
 * - 市が2つ以上あるときだけ、上に「すべて／日曜市／木曜市…」のチップを出して絞り込めるようにする
 * - 日めくりは、選んだ市（すべてなら一番近い市）の次の開催日を出す
 * - 一覧の行に市の名前を出すのは「すべて」のときだけ（絞り込み中はチップで伝わる）
 * 日曜市だけのときはチップを出さず、これまでどおりの見た目のままにする。
 */
export default function MarketCalendarView({ heading, dates, notice, monthCalendar }: Props) {
  const options = useMemo(() => listMarketOptions(dates), [dates]);
  const [marketId, setMarketId] = useState<string | null>(null);
  const visibleDates = useMemo(() => filterDatesByMarket(dates, marketId), [dates, marketId]);
  const next = findNextMarketDate(visibleDates);
  const showMonth = Boolean(monthCalendar) && (marketId === null || marketId === monthCalendar?.marketId);
  // 月カレンダーを出すときは、PC で2列になるよう幅を広げる（スマホは従来どおり1列）
  const wide = showMonth;

  return (
    <>
      <div className="bg-gradient-to-b from-nicchyo-soft-green/25 to-transparent pb-6 pt-safe-top">
        <PageContainer width={wide ? "wide" : "narrow"} className="pt-6">
          {heading}

          {options.length > 1 && (
            <div role="group" aria-label="市で絞り込む" className="-mx-1 mt-4 flex flex-wrap gap-2 px-1">
              <MarketChip label="すべて" selected={marketId === null} onClick={() => setMarketId(null)} />
              {options.map((option) => (
                <MarketChip
                  key={option.id}
                  label={option.name}
                  selected={marketId === option.id}
                  onClick={() => setMarketId(option.id)}
                />
              ))}
            </div>
          )}

          {next && (
            <MarketStatusCalendar
              key={`${next.marketId}:${next.dateIso}`}
              date={next}
              className="mt-5"
              link={false}
              unregisteredLabel="開催予定"
            />
          )}
          {notice}
        </PageContainer>
      </div>

      <PageContainer width={wide ? "wide" : "narrow"}>
        {showMonth && monthCalendar ? (
          // PC では月カレンダーを左、一覧を右に並べて、画面の横幅を使い切らないようにする
          <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
            <div className="pt-6 lg:sticky lg:top-6">
              <MarketMonthCalendar
                events={monthCalendar.events}
                days={monthCalendar.days}
                knownRange={monthCalendar.knownRange}
              />
            </div>
            <div className="min-w-0">
              <UpcomingMarketDates
                dates={visibleDates}
                showHeading={false}
                showStatusSource
                showMarketName={marketId === null}
              />
            </div>
          </div>
        ) : (
          <UpcomingMarketDates
            dates={visibleDates}
            showHeading={false}
            showStatusSource
            showMarketName={marketId === null}
          />
        )}
      </PageContainer>
    </>
  );
}

function MarketChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-chip px-4 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
        selected
          ? "bg-nicchyo-ink text-white shadow-chip"
          : "bg-white text-nicchyo-ink/75 ring-1 ring-line hover:bg-nicchyo-base"
      )}
    >
      {label}
    </button>
  );
}
