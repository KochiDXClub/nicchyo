import Link from "next/link";
import SiteGuideLink from "@/app/components/SiteGuideLink";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import NavigationBar from "../../components/NavigationBar";
import MarketStatusCalendar from "../../components/market/MarketStatusCalendar";
import UpcomingSundays from "../../components/market/UpcomingSundays";
import { createClient } from "@/utils/supabase/server";
import {
  fetchMarketCalendar,
  groupEventsBySunday,
  UPCOMING_SUNDAYS_FULL_COUNT,
} from "@/lib/market/calendar";
import { PageContainer, PageShell } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "日曜市カレンダー",
  description:
    "高知・日曜市の開催状況とこれからのイベント予定。荒天中止や特別開催のお知らせもここで確認できます。",
};

export default async function MarketCalendarPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const calendar = await fetchMarketCalendar(supabase).catch(() => null);
  const sundays = calendar ? groupEventsBySunday(calendar.events, calendar.days, UPCOMING_SUNDAYS_FULL_COUNT) : [];

  return (
    <PageShell as="main" topNav>
      <div className="bg-gradient-to-b from-nicchyo-soft-green/25 to-transparent pb-6 pt-safe-top">
        <PageContainer width="narrow" className="pt-6">
          <SiteGuideLink />
          <h1 className="mt-1 text-[2rem] font-black leading-none tracking-tight">
            日曜市カレンダー
          </h1>
          <p className="mt-2.5 text-sm text-nicchyo-ink/55">
            次の日曜市の開催状況と、これからの予定を確認できます。
          </p>

          {calendar ? <MarketStatusCalendar day={calendar.day} className="mt-5" link={false} unregisteredLabel="通常予定" /> : <p role="status" className="mt-5">開催状況を取得できませんでした。時間をおいて再度ご確認ください。</p>}
        </PageContainer>
      </div>

      <PageContainer width="narrow">
        {calendar && (
          <>
            <section aria-labelledby="calendar-status-guide" className="mb-6 rounded-card bg-white p-5 ring-1 ring-line">
              <h2 id="calendar-status-guide" className="font-bold">開催状況の見方</h2>
              <dl className="mt-3 space-y-3 text-sm leading-relaxed">
                <div>
                  <dt className="font-bold">通常予定</dt>
                  <dd className="text-nicchyo-ink/75">その日の開催情報は未登録です。毎週日曜の通常日程をもとに表示しています。</dd>
                </div>
                <div>
                  <dt className="font-bold">運営が登録</dt>
                  <dd className="text-nicchyo-ink/75">運営が登録した開催・中止などの情報です。「更新」は情報が最後に保存された時刻を示します。</dd>
                </div>
              </dl>
            </section>
            <h2 className="mb-2 text-lg font-bold">これからの開催日</h2>
            <UpcomingSundays sundays={sundays} showHeading={false} showStatusSource />
          </>
        )}
        <div className="mt-5 flex flex-wrap gap-x-5">
          <Link href="/story" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">出店者の近況を見る</Link>
          <Link href="/contact?category=bug#corrections" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">掲載情報の訂正を知らせる</Link>
        </div>
      </PageContainer>

      <NavigationBar backBarOnTop />
    </PageShell>
  );
}
