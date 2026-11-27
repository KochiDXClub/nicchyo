import Link from "next/link";
import SiteGuideLink from "@/app/components/SiteGuideLink";
import type { Metadata } from "next";
import NavigationBar from "../../components/NavigationBar";
import MarketCalendarView from "./components/MarketCalendarView";
import { addDaysToIso, getMarketCalendarDates, PUBLIC_CALENDAR_WEEKS } from "@/lib/market/calendar";
import { loadPublicMarketCalendar } from "@/lib/market/calendar.server";
import { PageContainer, PageShell } from "@/components/ui";
import { findNextMarketDate } from "./marketFilter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "市の開催カレンダー",
  description:
    "高知の市の開催状況とこれからのイベント予定。荒天中止や特別開催のお知らせもここで確認できます。",
};

export default async function MarketCalendarPage() {
  const calendar = await loadPublicMarketCalendar().catch(() => null);
  const dates = calendar ? getMarketCalendarDates(calendar, PUBLIC_CALENDAR_WEEKS.full) : [];
  const next = findNextMarketDate(dates);
  // 日曜市の月カレンダー。取得できた期間だけを確かな情報として塗る（それ以外の日曜は未定）
  const sundayMarket = calendar?.markets.find((market) => market.weekday === 0);
  const monthCalendar =
    calendar && sundayMarket
      ? {
          marketId: sundayMarket.id,
          events: sundayMarket.events,
          days: sundayMarket.days,
          knownRange: {
            from: calendar.todayIso,
            to: addDaysToIso(calendar.todayIso, PUBLIC_CALENDAR_WEEKS.landing * 7 - 1),
          },
        }
      : null;
  const title = next?.marketName ? "市の開催カレンダー" : "日曜市カレンダー";

  const heading = (
    <>
      <SiteGuideLink />
      <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-nicchyo-primary">Market Calendar</p>
      <h1 className={`mt-1 font-black leading-none tracking-tight ${next?.marketName ? "text-[1.75rem] sm:text-[2rem]" : "text-[2rem]"}`}>
        {title}
      </h1>
      <p className="mt-2.5 text-sm text-nicchyo-ink/55">各市の開催状況と、これからの予定を確認できます。</p>
    </>
  );
  const notice = !calendar ? (
    <p role="status" className="mt-5">開催状況を取得できませんでした。時間をおいて再度ご確認ください。</p>
  ) : dates.length === 0 ? (
    <p className="mt-5">公開中の市の予定はありません。</p>
  ) : null;

  return (
    <PageShell as="main" topNav>
      <MarketCalendarView heading={heading} dates={dates} notice={notice} monthCalendar={monthCalendar} />

      <PageContainer width="narrow">
        <p className="mt-6 text-center text-[11px] leading-relaxed text-nicchyo-ink/40">
          出店者ごとの当日の様子は
          <br />
          <a href="/story" className="font-semibold text-nicchyo-primary underline underline-offset-2">
            近況
          </a>
          でご覧いただけます
        </p>
        <div className="mt-5 flex flex-wrap gap-x-5">
          <Link href="/story" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">出店者の近況を見る</Link>
          <Link href="/contact?category=bug#corrections" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">掲載情報の訂正を知らせる</Link>
        </div>
      </PageContainer>

      <NavigationBar backBarOnTop />
    </PageShell>
  );
}
