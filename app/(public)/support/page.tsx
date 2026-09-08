import Link from "next/link";
import NavigationBar from "../../components/NavigationBar";
import MapLink from "../../components/MapLink";
import { fetchWeeklyVisitors } from "@/lib/analytics/weeklyVisitors.server";
import { fetchPublishedShopCount } from "@/lib/support/shopCount.server";
import SupporterSlots from "@/components/SupporterSlots";
import { buildFundingSegments, OTHER_FUNDING_COLOR } from "@/lib/support/supporters";
import RunwayMeter from "./RunwayMeter";
import SupportHero from "./components/SupportHero";
import SupportSummaryBar from "./components/SupportSummaryBar";
import CostLedger from "./components/CostLedger";
import TrackRecord from "./components/TrackRecord";
import {
  FUNDS_ON_HAND_JPY,
  RUNNING_COSTS,
  RUNWAY_MONTHS,
  SPONSOR_UNIT_ANNUAL_JPY,
  annualCostJpy,
  formatJpy,
  hasPendingCost,
  monthlyCostJpy,
  runwayMonths,
  sponsorUnitMonths,
} from "./costs";

export const metadata = {
  title: "運営について",
  description:
    "nicchyo の運営にかかる費用と、ご支援いただいている状況をご報告しております。協賛のご相談も承っております。",
  openGraph: {
    title: "運営について | nicchyo",
    description:
      "高知・日曜市の地図 nicchyo は、高知高専の学生と顧問の教員が運営しております。かかっている費用と、ご支援いただいている状況を公開しております。",
  },
};

/** 入口を過ぎたことを要約バーに知らせる目印 */
const HERO_SENTINEL_ID = "support-hero-end";

/**
 * 見出しと中身を左右に分ける。読み物ではなく報告なので、見出しは横に置いて
 * 本文の流れを切らない。デスクトップでは見出しがその節のあいだ貼り付く
 */
function Section({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t border-nicchyo-ink/10 pt-10 lg:grid lg:grid-cols-12 lg:gap-x-12 lg:pt-16"
    >
      <h2 className="text-[11px] font-bold tracking-[0.2em] text-nicchyo-ink/40 lg:col-span-3 lg:sticky lg:top-24 lg:self-start">
        {label}
      </h2>
      <div className="mt-6 lg:col-span-9 lg:mt-0">{children}</div>
    </section>
  );
}

/** 数字ひとつ。取れなかったときは「集計中」に落とす */
function Figure({ label, value }: { label: string; value: number | null; }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.08em] text-nicchyo-ink/45">{label}</dt>
      <dd className="mt-1.5 text-[1.7rem] font-bold leading-none tabular-nums">
        {value === null ? (
          <span className="text-[15px] font-bold text-nicchyo-ink/30">集計中</span>
        ) : (
          value.toLocaleString("ja-JP")
        )}
      </dd>
    </div>
  );
}

export default async function SupportPage() {
  const [weeklyVisitors, shopCount] = await Promise.all([
    fetchWeeklyVisitors(),
    fetchPublishedShopCount(),
  ]);

  const monthly = monthlyCostJpy();
  const annual = annualCostJpy();
  const hasPending = hasPendingCost();
  // メーターの塗りを「誰が出した分か」で分ける
  const segments = buildFundingSegments({ fundsJpy: FUNDS_ON_HAND_JPY, monthlyJpy: monthly });
  const otherSegment = segments.find((segment) => segment.color === OTHER_FUNDING_COLOR);
  const runway = runwayMonths();
  const unitMonths = sponsorUnitMonths();

  const monthlyLabel = `${formatJpy(monthly)}${hasPending ? "以上" : ""}`;
  const runwayLabel = `${runway.toFixed(1)}ヶ月`;

  return (
    <main
      className="support-page min-h-screen bg-nicchyo-base text-nicchyo-ink"
      style={{ paddingBottom: "calc(var(--nav-bar-height) + var(--safe-bottom, 0px) + 2rem)" }}
    >
      <SupportSummaryBar
        monthlyLabel={monthlyLabel}
        runwayLabel={runwayLabel}
        totalMonths={RUNWAY_MONTHS}
        sentinelId={HERO_SENTINEL_ID}
      />

      <SupportHero
        monthlyLabel={monthlyLabel}
        runwayLabel={runwayLabel}
        totalMonths={RUNWAY_MONTHS}
      />
      <div id={HERO_SENTINEL_ID} aria-hidden />

      <div className="mx-auto max-w-[64rem] px-6 sm:px-8">
        {/* ── 運営費 ────────────────────────────────────────────────── */}
        <Section id="costs" label="運営費">
          <CostLedger
            costs={RUNNING_COSTS}
            monthlyTotalJpy={monthly}
            annualTotalJpy={annual}
            hasPending={hasPending}
          />
        </Section>

        {/* ── いまの状況 ─────────────────────────────────────────────── */}
        <Section label="いまの状況">
          {/* このページで唯一、面として立てるところ。図の主役はここだけにする */}
          <div className="rounded-[22px] bg-white p-6 shadow-[0_1px_2px_rgba(58,58,58,0.04),0_18px_40px_-28px_rgba(146,64,14,0.5)] ring-1 ring-nicchyo-ink/[0.07] sm:p-8">
            <p className="flex items-baseline gap-2.5">
              <span className="text-[3rem] font-bold leading-none tabular-nums sm:text-[3.5rem]">
                {runway.toFixed(1)}
              </span>
              <span className="text-[17px] font-bold text-nicchyo-ink/50">ヶ月</span>
              <span className="ml-auto text-[13px] tabular-nums text-nicchyo-ink/40">
                / {RUNWAY_MONTHS}ヶ月
              </span>
            </p>

            <div className="mt-6">
              <RunwayMeter
                segments={segments}
                totalMonths={RUNWAY_MONTHS}
                ghostMonths={unitMonths ?? undefined}
              />
            </div>

            {/* 「その他」は掲載枠に出ないので、色と金額をここで示す */}
            {otherSegment && (
              <p className="mt-5 flex items-center gap-2 text-[12.5px] tabular-nums text-nicchyo-ink/50">
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: otherSegment.color }}
                  aria-hidden
                />
                その他（助成金・賞金・匿名でのご支援） {formatJpy(otherSegment.amountJpy)}
              </p>
            )}

            <p className="mt-5 border-t border-nicchyo-ink/[0.07] pt-5 text-[13px] leading-[1.95] text-nicchyo-ink/55">
              {FUNDS_ON_HAND_JPY > 0
                ? `いただいた ${formatJpy(FUNDS_ON_HAND_JPY)} で、ここまで運営することができます。ありがとうございます。`
                : "これまでは、いただいた賞金と学生の負担で運営してまいりました。続けていくためのご協賛を探しております。"}
            </p>
          </div>

          {/* メーターの色がどの協賛かを、名前と金額で結びつける場所も兼ねる */}
          <h3 className="mt-12 text-[11px] font-bold tracking-[0.2em] text-nicchyo-ink/40">
            ご支援くださる皆さま
          </h3>
          <SupporterSlots className="mt-5" />
        </Section>

        {/* ── 届いている範囲 ──────────────────────────────────────────── */}
        <Section label="届いている範囲">
          <dl className="flex gap-10 border-b border-nicchyo-ink/[0.07] pb-7 sm:gap-16">
            <Figure label="マップに載っている店舗" value={shopCount} />
            <Figure label="今週の訪問者数" value={weeklyVisitors} />
          </dl>

          <div className="mt-10">
            <TrackRecord />
          </div>

          {/* 数字と実績は、お金以外のご協力の上に立っている。ここで名前を挙げておく */}
          <p className="mt-8 text-[13px] leading-[1.95] text-nicchyo-ink/55">
            日曜市に出店されているみなさま、高知市商業振興課のみなさまにご協力をいただき、ここまで続けてくることができました。
          </p>
        </Section>

        {/* ── ご相談について ──────────────────────────────────────────── */}
        <Section label="ご相談について">
          <dl className="border-t border-nicchyo-ink/10">
            <div className="border-b border-nicchyo-ink/[0.07] py-4">
              <dt className="text-[14px] font-bold">お支払いについて</dt>
              <dd className="mt-1.5 text-[13px] leading-[1.95] text-nicchyo-ink/55">
                サイト内での決済は承っておりません。運営者個人の氏名と住所を公開することになるためです。お問い合わせ箱にてご相談を承ります。
              </dd>
            </div>
            <div className="border-b border-nicchyo-ink/[0.07] py-4">
              <dt className="text-[14px] font-bold">掲載について</dt>
              <dd className="mt-1.5 text-[13px] leading-[1.95] text-nicchyo-ink/55">
                このページと「nicchyoとは」に、お名前またはロゴを掲載いたします。1年ごとに更新いたします。
              </dd>
            </div>
            <div className="border-b border-nicchyo-ink/[0.07] py-4">
              <dt className="text-[14px] font-bold">会計について</dt>
              <dd className="mt-1.5 text-[13px] leading-[1.95] text-nicchyo-ink/55">
                お預かりした資金は、運営費以外には使用いたしません。会計は顧問の教員が確認しております。
              </dd>
            </div>
          </dl>

          {SPONSOR_UNIT_ANNUAL_JPY !== null && unitMonths !== null && (
            <p className="mt-8 text-[1.4rem] font-bold leading-[1.6]">
              1口 {formatJpy(SPONSOR_UNIT_ANNUAL_JPY)}のご協賛で、
              {unitMonths.toFixed(1)}ヶ月ぶん運営することができます。
            </p>
          )}

          <Link
            href="/contact?category=sponsor"
            className="mt-8 flex w-full items-center justify-center rounded-2xl bg-nicchyo-ink px-4 py-4 text-[15px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(58,58,58,0.55)] transition hover:bg-nicchyo-ink/90 active:scale-[0.99] sm:w-fit sm:px-12"
          >
            協賛のご相談
          </Link>
        </Section>

        {/* 締め。お願いで終わらせず、いま支えてくださっている方への礼で閉じる */}
        <p className="mt-16 border-t border-nicchyo-ink/10 pt-10 text-[13px] leading-[2] text-nicchyo-ink/50">
          日曜市に関わるみなさまのお力添えで、この地図は続いております。いつもありがとうございます。
        </p>

        <div className="py-12 text-center">
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
