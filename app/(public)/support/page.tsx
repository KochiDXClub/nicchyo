import Image from "next/image";
import Link from "next/link";
import NavigationBar from "../../components/NavigationBar";
import MapLink from "../../components/MapLink";
import { fetchWeeklyVisitors } from "@/lib/analytics/weeklyVisitors.server";
import SupporterSlots from "@/components/SupporterSlots";
import RunwayMeter from "./RunwayMeter";
import {
  ANNUAL_COST_RANGE_JPY,
  FUNDS_ON_HAND_JPY,
  RUNNING_COSTS,
  RUNWAY_MONTHS,
  SPONSOR_UNIT_ANNUAL_JPY,
  TRACK_RECORD,
  formatJpy,
  hasCostBreakdown,
  monthlyCostJpy,
  runwayMonths,
  sponsorUnitMonths,
} from "./costs";

export const metadata = {
  title: "運営について",
  description:
    "nicchyo のサーバー代と、いまどこまで支えられているか。協賛のお願いについて。",
};

export default async function SupportPage() {
  const weeklyVisitors = await fetchWeeklyVisitors();
  const monthly = monthlyCostJpy();
  const runway = runwayMonths();
  const unitMonths = sponsorUnitMonths();
  const showBreakdown = hasCostBreakdown();

  return (
    <main className="min-h-screen bg-nicchyo-base text-nicchyo-ink pb-[calc(3rem+var(--safe-bottom))]">
      {/*
        入口は絵と余白だけ。数字は下にあるので、ここに文字を載せない。
        高さは画面のおよそ半分。小さい端末で潰れず、大きい端末で間延びしないよう上下を止める。
      */}
      <section className="relative isolate flex h-[44vh] min-h-[260px] max-h-[400px] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-amber-100/80 via-amber-50/50 to-nicchyo-base" />
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

      <div className="mx-auto max-w-lg px-6">
        <h1 className="text-[1.75rem] font-bold leading-snug tracking-tight">運営について</h1>
        <p className="mt-3 text-[15px] leading-loose text-nicchyo-ink/60">
          高知高専の学生と顧問の教員で動かしています。広告はありません。
        </p>

        {/* このページで唯一の図。必要額と集まった額を1つのメーターで見せる */}
        <section className="mt-14">
          <h2 className="text-[12px] font-bold tracking-[0.1em] text-nicchyo-ink/40">
            支えられている期間
          </h2>
          <p className="mt-4 flex items-baseline gap-2">
            <span className="text-[3.5rem] font-bold leading-none text-nicchyo-ink">
              {runway.toFixed(1)}
            </span>
            <span className="text-lg font-bold text-nicchyo-ink/50">ヶ月</span>
            <span className="ml-auto text-[13px] text-nicchyo-ink/40">
              / {RUNWAY_MONTHS}ヶ月
            </span>
          </p>

          <div className="mt-6">
            <RunwayMeter months={runway} totalMonths={RUNWAY_MONTHS} />
          </div>

          <p className="mt-5 text-[13px] leading-relaxed text-nicchyo-ink/50">
            {FUNDS_ON_HAND_JPY > 0
              ? `お預かりしている ${formatJpy(FUNDS_ON_HAND_JPY)} で、ここまで動かせます。`
              : "いまは全額を学生が出しています。"}
          </p>
        </section>

        {/* 費用。図はメーターに任せ、ここは金額をそろえて並べるだけにする */}
        <section className="mt-14 border-t border-nicchyo-ink/10 pt-10">
          <h2 className="text-[12px] font-bold tracking-[0.1em] text-nicchyo-ink/40">
            毎月かかるお金
          </h2>

          {showBreakdown ? (
            <>
              <dl className="mt-5">
                {RUNNING_COSTS.map((cost) => (
                  <div
                    key={cost.label}
                    className="flex items-baseline justify-between gap-4 border-b border-nicchyo-ink/[0.06] py-3.5 last:border-0"
                  >
                    <dt>
                      <span className="block text-[15px] font-bold">{cost.label}</span>
                      <span className="block text-[12px] text-nicchyo-ink/40">{cost.purpose}</span>
                    </dt>
                    <dd className="shrink-0 text-[15px] font-bold tabular-nums">
                      {cost.monthlyJpy === null ? (
                        <span className="text-nicchyo-ink/30">調整中</span>
                      ) : (
                        formatJpy(cost.monthlyJpy)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 flex items-baseline justify-between gap-4">
                <span className="text-[13px] text-nicchyo-ink/50">合計</span>
                <span className="text-2xl font-bold tabular-nums">{formatJpy(monthly)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-[2rem] font-bold leading-none">約 {formatJpy(monthly)}</span>
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-nicchyo-ink/50">
                年 {formatJpy(ANNUAL_COST_RANGE_JPY.min)}〜{formatJpy(ANNUAL_COST_RANGE_JPY.max)}
                の見込みから、多い方で置いています。
              </p>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
                {RUNNING_COSTS.map((cost) => (
                  <li key={cost.label} className="text-[13px] text-nicchyo-ink/45">
                    {cost.label}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* 届いている範囲。ここに大きな数字を置くと、上のメーターと主役が割れる */}
        <section className="mt-14 border-t border-nicchyo-ink/10 pt-10">
          <h2 className="text-[12px] font-bold tracking-[0.1em] text-nicchyo-ink/40">
            届いているところ
          </h2>
          <dl className="mt-5">
            <div className="flex items-baseline justify-between gap-4 border-b border-nicchyo-ink/[0.06] py-3.5">
              <dt className="text-[15px] text-nicchyo-ink/70">今週の訪問者</dt>
              <dd className="shrink-0 text-[15px] font-bold tabular-nums">
                {weeklyVisitors === null
                  ? <span className="text-nicchyo-ink/30">集計中</span>
                  : `${weeklyVisitors.toLocaleString("ja-JP")}人`}
              </dd>
            </div>
            {TRACK_RECORD.map((item) => (
              <div
                key={item.label}
                className="flex items-baseline justify-between gap-4 border-b border-nicchyo-ink/[0.06] py-3.5 last:border-0"
              >
                <dt className="text-[15px] text-nicchyo-ink/70">{item.label}</dt>
                <dd className="shrink-0 text-[15px] font-bold">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 空いているうちも枠を出す。協賛すると何が得られるかは、枠を見せた方が早い */}
        <section className="mt-14 border-t border-nicchyo-ink/10 pt-10">
          <h2 className="text-[12px] font-bold tracking-[0.1em] text-nicchyo-ink/40">
            支えてくださる方
          </h2>
          <SupporterSlots className="mt-5" />
        </section>

        {/* 協賛。金額が決まっていれば「1口で何ヶ月ぶん」まで出す */}
        <section className="mt-14 border-t border-nicchyo-ink/10 pt-10">
          <h2 className="text-[12px] font-bold tracking-[0.1em] text-nicchyo-ink/40">
            協賛のお願い
          </h2>

          {SPONSOR_UNIT_ANNUAL_JPY !== null && unitMonths !== null && (
            <p className="mt-4 text-[1.75rem] font-bold leading-snug">
              1口 {formatJpy(SPONSOR_UNIT_ANNUAL_JPY)}で、
              <br />
              {unitMonths.toFixed(1)}ヶ月ぶん動きます。
            </p>
          )}

          <Link
            href="/contact?category=sponsor"
            className="mt-6 flex w-full items-center justify-center rounded-2xl bg-nicchyo-ink px-4 py-4 text-[15px] font-bold text-white transition active:scale-[0.99] hover:bg-nicchyo-ink/90"
          >
            協賛について問い合わせる
          </Link>
          <p className="mt-3 text-[12px] text-nicchyo-ink/40">
            掲載は1年ごとに更新します
          </p>
        </section>

        <p className="mt-14 border-t border-nicchyo-ink/10 pt-8 text-[12px] leading-loose text-nicchyo-ink/40">
          いただいたお金は運営費だけに使います。会計は顧問の教員が確認しています。
        </p>

        <div className="py-10 text-center">
          <MapLink
            href="/map"
            className="text-[13px] font-bold text-nicchyo-ink/40 transition hover:text-nicchyo-ink/70"
          >
            マップに戻る
          </MapLink>
        </div>
      </div>

      <NavigationBar />
    </main>
  );
}
