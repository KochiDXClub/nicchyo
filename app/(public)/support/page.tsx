import Image from "next/image";
import Link from "next/link";
import NavigationBar from "../../components/NavigationBar";
import MapLink from "../../components/MapLink";
import { fetchWeeklyVisitors } from "@/lib/analytics/weeklyVisitors.server";
import {
  ANNUAL_COST_RANGE_JPY,
  RUNNING_COSTS,
  SPONSOR_PLAN,
  SUPPORTERS,
  TRACK_RECORD,
  formatJpy,
  hasCostBreakdown,
  sumMonthlyJpy,
} from "./costs";

export const metadata = {
  title: "運営について",
  description:
    "nicchyo は高知高専の学生と顧問の教員が運営しています。サーバー代などの運営費と、支援・協賛のお願いについて。",
};

export default async function SupportPage() {
  const weeklyVisitors = await fetchWeeklyVisitors();
  const monthlyTotal = sumMonthlyJpy();
  const showBreakdown = hasCostBreakdown();

  return (
    <main className="min-h-screen bg-nicchyo-base text-gray-900 pb-[calc(3rem+var(--safe-bottom))]">
      {/*
        入口は絵と余白だけに使う。数字と本文は下にあるので、ここに文字を載せない。
        高さは画面のおよそ半分。小さい端末で潰れず、大きい端末で間延びしないよう上下を止める。
      */}
      <section className="relative isolate flex h-[48vh] min-h-[280px] max-h-[440px] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-amber-100/80 via-amber-50/60 to-nicchyo-base" />
        {/* にちよさんの後ろに置く光。輪郭を出さずに奥行きだけ足す */}
        <div className="absolute left-1/2 top-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-[58%] rounded-full bg-white/70 blur-3xl sm:h-80 sm:w-80" />
        <Image
          src="/images/obaasan_transparent.png"
          alt=""
          width={512}
          height={512}
          priority
          draggable={false}
          className="h-[84%] w-auto select-none object-contain"
          aria-hidden
        />
      </section>

      <div className="mx-auto max-w-xl px-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-amber-600">Support</p>
        <h1 className="mt-2 text-[2rem] font-black leading-tight tracking-tight">運営について</h1>
        <p className="mt-5 text-[15px] leading-loose text-gray-600">
          nicchyo は高知高専の学生と顧問の教員が運営しています。広告は入れていません。
          かかっているのはサーバー代などの実費だけで、人件費は受け取っていません。
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-xl px-5">
        {/* いま届いている範囲。協賛を検討する人が最初に見る数字 */}
        <section className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <h2 className="text-[13px] font-bold text-gray-500">いまの nicchyo</h2>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tabular-nums text-gray-900">
              {weeklyVisitors === null ? "集計中" : weeklyVisitors.toLocaleString("ja-JP")}
            </span>
            {weeklyVisitors !== null && <span className="text-sm font-bold text-gray-500">人</span>}
          </p>
          <p className="mt-1 text-xs text-gray-500">今週の訪問者</p>

          <ul className="mt-4 space-y-2 border-t border-gray-100 pt-4">
            {TRACK_RECORD.map((item) => (
              <li key={item.label} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-gray-600">{item.label}</span>
                <span className="shrink-0 font-bold text-gray-900">{item.value}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 運営費 */}
        <section className="mt-5 rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <h2 className="text-[13px] font-bold text-gray-500">かかっている費用</h2>

          {showBreakdown ? (
            <>
              <ul className="mt-3 divide-y divide-gray-100">
                {RUNNING_COSTS.map((cost) => (
                  <li key={cost.label} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-gray-900">{cost.label}</span>
                      <span className="block text-xs text-gray-500">{cost.purpose}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900">
                      {cost.monthlyJpy === null ? "調整中" : `${formatJpy(cost.monthlyJpy)}／月`}
                    </span>
                  </li>
                ))}
              </ul>
              {monthlyTotal !== null && (
                <p className="mt-3 border-t border-gray-100 pt-3 text-right text-sm font-bold text-gray-900">
                  月あたり {formatJpy(monthlyTotal)}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mt-3 text-2xl font-black tabular-nums text-gray-900">
                年 {formatJpy(ANNUAL_COST_RANGE_JPY.min)} 〜 {formatJpy(ANNUAL_COST_RANGE_JPY.max)}
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {RUNNING_COSTS.map((cost) => (
                  <li key={cost.label} className="text-xs text-gray-500">
                    {cost.label}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* 協賛 */}
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <h2 className="text-[13px] font-bold text-amber-800">協賛のお願い</h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-900">
            この運営費を、高知の企業・お店の方に支えていただけないか探しています。
          </p>

          <dl className="mt-4 space-y-2.5 text-sm">
            {SPONSOR_PLAN.unitAnnualJpy !== null && (
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-amber-700">金額</dt>
                <dd className="font-bold text-amber-900">
                  1口 {formatJpy(SPONSOR_PLAN.unitAnnualJpy)}／年
                </dd>
              </div>
            )}
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 text-amber-700">掲載</dt>
              <dd className="text-amber-900">{SPONSOR_PLAN.places.join("、")}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 text-amber-700">期間</dt>
              <dd className="text-amber-900">{SPONSOR_PLAN.term}</dd>
            </div>
          </dl>

          <Link
            href="/contact?category=sponsor"
            className="mt-5 flex w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-500 active:scale-[0.99]"
          >
            協賛について問い合わせる
          </Link>
        </section>

        {/* 支援者。まだ居ないうちは出さない */}
        {SUPPORTERS.length > 0 && (
          <section className="mt-5 rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <h2 className="text-[13px] font-bold text-gray-500">支えてくださっている方</h2>
            <ul className="mt-3 space-y-2">
              {SUPPORTERS.map((supporter) => (
                <li key={supporter.name} className="text-sm">
                  <span className="font-bold text-gray-900">{supporter.name}</span>
                  {supporter.note && (
                    <span className="ml-2 text-xs text-gray-500">{supporter.note}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-6 text-xs leading-relaxed text-gray-500">
          いただいたお金は、上に挙げた運営費だけに使います。会計は顧問の教員が確認しています。
        </p>

        <div className="py-8 text-center">
          <MapLink
            href="/map"
            className="inline-flex items-center text-sm font-semibold text-gray-500 transition hover:text-amber-600"
          >
            ← マップに戻る
          </MapLink>
        </div>
      </div>

      <NavigationBar />
    </main>
  );
}
