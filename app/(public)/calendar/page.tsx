import type { Metadata } from "next";
import { cookies } from "next/headers";
import NavigationBar from "../../components/NavigationBar";
import MarketStatusBar from "../../components/market/MarketStatusBar";
import UpcomingEvents from "../../components/market/UpcomingEvents";
import { createClient } from "@/utils/supabase/server";
import { fetchMarketCalendar } from "@/lib/market/calendar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "日曜市カレンダー | nicchyo 日曜市",
  description:
    "高知・日曜市の開催状況とこれからのイベント予定。荒天中止や特別開催のお知らせもここで確認できます。",
};

export default async function MarketCalendarPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { day, events } = await fetchMarketCalendar(supabase);

  return (
    <main className="min-h-screen bg-nicchyo-base pb-24 text-nicchyo-ink">
      <div className="bg-gradient-to-b from-nicchyo-soft-green/25 to-transparent pb-6 pt-safe-top">
        <div className="mx-auto flex max-w-lg flex-col px-4 pt-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-nicchyo-primary">
            Market Calendar
          </p>
          <h1 className="mt-1 text-[2rem] font-black leading-none tracking-tight">
            日曜市カレンダー
          </h1>
          <p className="mt-2.5 text-sm text-gray-500">
            開催状況とこれからの予定をお届けします
          </p>

          <MarketStatusBar day={day} placement="page" className="mt-5" />
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4">
        <UpcomingEvents events={events} />

        <p className="mt-6 text-center text-[11px] leading-relaxed text-gray-400">
          出店者ごとの当日の様子は
          <br />
          <a href="/story" className="font-semibold text-nicchyo-primary underline underline-offset-2">
            近況
          </a>
          でご覧いただけます
        </p>
      </div>

      <NavigationBar />
    </main>
  );
}
