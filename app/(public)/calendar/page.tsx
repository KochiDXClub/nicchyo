import type { Metadata } from "next";
import NavigationBar from "../../components/NavigationBar";
import MarketStatusCalendar from "../../components/market/MarketStatusCalendar";
import UpcomingMarketDates from "../../components/market/UpcomingMarketDates";
import { getMarketCalendarDates, PUBLIC_CALENDAR_WEEKS } from "@/lib/market/calendar";
import { loadPublicMarketCalendar } from "@/lib/market/calendar.server";
import { PageContainer, PageShell } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "市の開催カレンダー",
  description:
    "高知の市の開催状況とこれからのイベント予定。荒天中止や特別開催のお知らせもここで確認できます。",
};

export default async function MarketCalendarPage() {
  const calendar = await loadPublicMarketCalendar().catch(() => null);
  const dates = calendar ? getMarketCalendarDates(calendar, PUBLIC_CALENDAR_WEEKS.full) : [];
  const next = dates.find((date) => date.status !== null);
  const title = next?.marketName ? "市の開催カレンダー" : "日曜市カレンダー";

  return (
    <PageShell as="main" topNav>
      <div className="bg-gradient-to-b from-nicchyo-soft-green/25 to-transparent pb-6 pt-safe-top">
        <PageContainer width="narrow" className="pt-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-nicchyo-primary">
            Market Calendar
          </p>
          <h1 className={`mt-1 font-black leading-none tracking-tight ${next?.marketName ? "text-[1.75rem] sm:text-[2rem]" : "text-[2rem]"}`}>
            {title}
          </h1>
          <p className="mt-2.5 text-sm text-nicchyo-ink/55">
            開催状況とこれからの予定をお届けします
          </p>

          {next && <MarketStatusCalendar date={next} className="mt-5" link={false} />}
          {!calendar && <p role="status" className="mt-5">開催状況を取得できませんでした。時間をおいて再度ご確認ください。</p>}
          {calendar && dates.length === 0 && <p className="mt-5">公開中の市の予定はありません。</p>}
        </PageContainer>
      </div>

      <PageContainer width="narrow">
        <UpcomingMarketDates dates={dates} showHeading={false} />

        <p className="mt-6 text-center text-[11px] leading-relaxed text-nicchyo-ink/40">
          出店者ごとの当日の様子は
          <br />
          <a href="/story" className="font-semibold text-nicchyo-primary underline underline-offset-2">
            近況
          </a>
          でご覧いただけます
        </p>
      </PageContainer>

      <NavigationBar backBarOnTop />
    </PageShell>
  );
}
