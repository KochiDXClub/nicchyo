"use client";

import { useMemo, useState, type ReactNode } from "react";
import MarketMonthCalendar from "@/app/components/market/MarketMonthCalendar";
import MarketStatusCalendar from "@/app/components/market/MarketStatusCalendar";
import UpcomingMarketDates from "@/app/components/market/UpcomingMarketDates";
import { PageContainer, Surface } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type { MarketCalendarDate, MarketDay, MarketEvent } from "@/lib/market/calendar";
import { filterDatesByMarket, findNextMarketDate, listMarketOptions } from "../marketFilter";

type Props = {
  /** ページの見出し（帯の中、チップの上に置く） */
  heading: ReactNode;
  dates: MarketCalendarDate[];
  /** 帯の中に出す案内（取得の失敗など） */
  notice?: ReactNode;
  /** 一覧の下に添える案内とリンク */
  footer?: ReactNode;
  /** 日曜市の月カレンダー。日曜市が見えているときだけ出す */
  monthCalendar?: {
    marketId: string;
    events: MarketEvent[];
    days: MarketDay[];
    knownRange: { from: string; to: string };
  } | null;
};

/**
 * PC で2列にするときの列。左が「月で見る」、右が「日ごとの一覧」。
 * 見出し帯と本文で同じ列を使い、上下で端がそろうようにする（バラつくと落ち着かない）。
 */
const COLUMNS = "lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-x-8";

/**
 * 市の開催カレンダーの本体。
 *
 * 来訪者が知りたいのは「どの市が・いつ・いつもどおり開くか」。そのために
 * - いちばん上に「次の開催」を1枚だけ持ち上げて置く（画面の主役は1つ）
 * - 市が2つ以上あるときだけ「すべて／日曜市／木曜市…」のチップで絞り込めるようにする
 * - 日曜市が見えているときは月カレンダーを添え、PC では左に月・右に日ごとの一覧を並べる
 * スマホは上から「見出し → 次の開催 → 月 → 一覧」の1列で読む。
 */
export default function MarketCalendarView({ heading, dates, notice, footer, monthCalendar }: Props) {
  const options = useMemo(() => listMarketOptions(dates), [dates]);
  const [marketId, setMarketId] = useState<string | null>(null);
  const visibleDates = useMemo(() => filterDatesByMarket(dates, marketId), [dates, marketId]);
  const next = findNextMarketDate(visibleDates);
  const month =
    monthCalendar && (marketId === null || marketId === monthCalendar.marketId) ? monthCalendar : null;
  const width = month ? "wide" : "narrow";
  const hasMarketNames = dates.some((date) => date.marketName);

  const list = (
    <section aria-labelledby="calendar-list-heading" className="min-w-0">
      <SectionHeading id="calendar-list-heading" note="運営からのお知らせ">
        {hasMarketNames ? "これからの開催日" : "これからの日曜市"}
      </SectionHeading>
      <UpcomingMarketDates
        dates={visibleDates}
        showHeading={false}
        showStatusSource
        showMarketName={marketId === null}
      />
      {footer}
    </section>
  );

  return (
    <>
      <div className="bg-gradient-to-b from-nicchyo-soft-green/25 to-transparent pt-safe-top">
        {/* PC は右上に「もどる」が浮くので、その下から見出しを始める */}
        <PageContainer width={width} className="pb-2 pt-6 lg:pt-20">
          <div className={cn(month && COLUMNS, "lg:items-end")}>
            <div className="min-w-0">
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
            </div>

            {next && (
              // 画面の主役。PC では見出しの右に、一覧のカードと右端をそろえて置く
              <Surface elevation="lifted" padding="sm" className="mt-5 lg:mt-0 lg:justify-self-end lg:pr-6">
                <MarketStatusCalendar
                  key={`${next.marketId}:${next.dateIso}`}
                  date={next}
                  link={false}
                  unregisteredLabel="開催予定"
                />
              </Surface>
            )}
          </div>
          {notice}
        </PageContainer>
      </div>

      <PageContainer width={width} className="mt-6 lg:mt-8">
        {month ? (
          <div className={cn(COLUMNS, "lg:items-start")}>
            <section aria-labelledby="calendar-month-heading" className="mb-8 lg:sticky lg:top-6 lg:mb-0">
              <SectionHeading id="calendar-month-heading" note="色で開催・中止がわかります">
                月で見る
              </SectionHeading>
              <MarketMonthCalendar
                events={month.events}
                days={month.days}
                knownRange={month.knownRange}
                className="mb-0 mt-2 rounded-card border-0 p-4 shadow-card ring-1 ring-line"
              />
            </section>
            {list}
          </div>
        ) : (
          list
        )}
      </PageContainer>
    </>
  );
}

/** 本文の区切りの見出し。左右の列で同じ高さ・同じ形にそろえる */
function SectionHeading({ id, note, children }: { id: string; note?: string; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 id={id} className="text-base font-bold text-nicchyo-ink">
        {children}
      </h2>
      {note && <span className="text-xs text-nicchyo-ink/55">{note}</span>}
    </div>
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
