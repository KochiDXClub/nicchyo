import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from "@/lib/siteLinks";
import NavigationBar from "../../components/NavigationBar";
import { fetchWeeklyVisitors } from "@/lib/analytics/visitorStats.server";
import { fetchPublishedShopCount } from "@/lib/support/shopCount.server";
import SupporterSlots from "@/components/SupporterSlots";
import { buildFundingSegments, OTHER_FUNDING_COLOR } from "@/lib/support/supporters";
import RunwayMeter from "./RunwayMeter";
import SupportHero from "./components/SupportHero";
import SupportFloatingCta from "./components/SupportFloatingCta";
import CostLedger from "./components/CostLedger";
import TrackRecord from "./components/TrackRecord";
import TeamStructure from "./components/TeamStructure";
import SupportWays from "./components/SupportWays";
import { CountUp, RiseHeading } from "./components/SupportMotion";
import Reveal from "@/components/Reveal";
import { totalIndividualSupporters } from "@/lib/support/individualSupporters";
import {
  FUNDS_ON_HAND_JPY,
  RUNNING_COSTS,
  RUNWAY_MONTHS,
  SPONSOR_UNIT_ANNUAL_JPY,
  TOTAL_RECEIVED_JPY,
  annualCostJpy,
  formatJpy,
  hasPendingCost,
  monthlyCostJpy,
  runwayMonths,
  sponsorUnitMonths,
} from "./costs";

export const metadata = {
  title: "協賛・ご支援について",
  description:
    "nicchyo の運営にかかる費用と、ご支援いただいている状況をご報告しております。協賛のご相談も承っております。",
  openGraph: {
    title: "協賛・ご支援について | nicchyo",
    description:
      "高知・日曜市の地図 nicchyo は、高知高専の学生と顧問の教員が運営しております。かかっている費用と、ご支援いただいている状況を公開しております。",
  },
};

/** 入口を包む枠。これが画面の上へ抜けたら、右下のボタンを出す */
const HERO_ID = "support-hero";

/** お金以外のご支援の入口。リポジトリは公開しているので、そこへ素直につなぐ */
const CODE_LINKS = [
  {
    href: GITHUB_REPO_URL,
    title: "GitHub でコードを見る",
    body: "KochiDXClub/nicchyo。オープンソースで開発しております",
  },
  {
    href: GITHUB_ISSUES_URL,
    title: "気づいたことを届ける",
    body: "不具合の報告や機能の提案は Issues へ。GitHub のアカウントがあればどなたでも書けます",
  },
];

/** ご相談の前にお伝えしておくこと */
const CONSULT_NOTES = [
  {
    title: "お支払いについて",
    body: "サイト内での決済は承っておりません。お問い合わせ箱にてご相談を承ります。",
  },
  {
    title: "税制上の優遇について",
    body: "恐れ入りますが、寄附金控除などの税制上の優遇の対象にはなりません。あらかじめご了承いただけますと幸いです。",
  },
  {
    title: "会計について",
    body: "お預かりした資金は、運営費以外には使用いたしません。会計は顧問の教員が確認しております。",
  },
];

/**
 * 1つの節。小さな見出し（何の話か）の下に、言い切りの見出し（何が言いたいか）を置く。
 *
 * 見出しだけを拾い読みしても、このページの話がひと通りつながるように書くこと。
 * 本文は見出しを裏づける図と数字に絞り、説明の文章はなるべく足さない。
 *
 * 見出しは文節ごとに分けて渡す。日本語は語中でも折り返すので、素のままだと
 * 狭い画面で「その／まま」のように切れる。文節を折り返さない塊にしておけば、
 * 広い画面では1行に、狭い画面では文節の切れ目で折り返す。
 */
function Section({
  id,
  label,
  title,
  children,
}: {
  id?: string;
  label: string;
  /** 文節ごとに区切った見出し。1つあたり12文字までにしておくと、どの幅でも収まる */
  title: string[];
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-nicchyo-ink/[0.07] py-12 sm:py-16">
      <p className="text-[11px] font-bold tracking-[0.2em] text-amber-700/80">{label}</p>
      <RiseHeading className="mt-3 text-[1.4rem] font-bold leading-[1.55] tracking-tight sm:text-[1.75rem]">
        {title.map((phrase) => (
          <span key={phrase} className="inline-block">
            {phrase}
          </span>
        ))}
      </RiseHeading>
      <Reveal className="mt-7 sm:mt-9" delay={0.1}>
        {children}
      </Reveal>
    </section>
  );
}

/** 数字ひとつ。取れなかったときは「集計中」に落とす */
function Figure({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.08em] text-nicchyo-ink/45">{label}</dt>
      <dd className="mt-2 text-[2.2rem] font-bold leading-none tabular-nums sm:text-[2.6rem]">
        {value === null ? (
          <span className="text-[15px] font-bold text-nicchyo-ink/30">集計中</span>
        ) : (
          <CountUp value={value} delay={0.2} />
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

  const individualSupporterCount = totalIndividualSupporters();

  return (
    <main
      className="support-page min-h-screen bg-nicchyo-base text-nicchyo-ink"
      // 右下のボタンが最後の行に重ならないよう、そのぶんも空けておく
      style={{ paddingBottom: "calc(var(--nav-bar-height) + var(--safe-bottom, 0px) + 5.5rem)" }}
    >
      <div id={HERO_ID}>
        <SupportHero
          monthlyJpy={monthly}
          hasPending={hasPending}
          totalReceivedJpy={TOTAL_RECEIVED_JPY}
          runway={runway}
          totalMonths={RUNWAY_MONTHS}
        />
      </div>

      <div className="mx-auto max-w-[64rem] px-6 sm:px-8">
        {/* ── 運営費 ────────────────────────────────────────────────── */}
        <Section id="costs" label="運営費" title={["かかっている費用を、", "そのまま公開しております"]}>
          <CostLedger
            costs={RUNNING_COSTS}
            monthlyTotalJpy={monthly}
            annualTotalJpy={annual}
            hasPending={hasPending}
          />
        </Section>

        {/* ── いまの状況 ─────────────────────────────────────────────── */}
        <Section
          label="いまの状況"
          title={
            FUNDS_ON_HAND_JPY > 0
              ? ["1年のうち", `${runway.toFixed(1)}ヶ月ぶんを、`, "支えていただいております"]
              : ["続けていくための", "ご協賛を、", "探しております"]
          }
        >
          {/* このページで唯一、面として立てるところ。図の主役はここだけにする */}
          <div className="rounded-card bg-white p-6 shadow-lift ring-1 ring-nicchyo-ink/[0.07] sm:p-8">
            <p className="flex items-baseline gap-2.5">
              <span className="text-[3rem] font-bold leading-none tabular-nums sm:text-[3.5rem]">
                <CountUp value={runway} decimals={1} delay={0.3} />
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

            {/*
              斜線は「1口入るとここまで伸びる」という予告なので、何を指しているかを
              必ず言葉で添える。図だけ出しても、塗り忘れにしか見えない
            */}
            {unitMonths !== null && (
              <p className="mt-4 flex items-center gap-2 text-[12.5px] text-nicchyo-ink/50">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-[repeating-linear-gradient(-45deg,rgba(217,119,6,0.45)_0_3px,rgba(217,119,6,0.12)_3px_6px)]"
                  aria-hidden
                />
                ご協賛1口で、ここまで伸びます
              </p>
            )}

            {/* 「その他」は掲載枠に出ないので、色と金額をここで示す */}
            {otherSegment && (
              <p className="mt-3 flex items-center gap-2 text-[12.5px] tabular-nums text-nicchyo-ink/50">
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: otherSegment.color }}
                  aria-hidden
                />
                その他（助成金・賞金・匿名でのご支援） {formatJpy(otherSegment.amountJpy)}
              </p>
            )}
          </div>

          {/* メーターの色がどの協賛かを、名前と金額で結びつける場所も兼ねる。
              個人のご支援は別のページなので、見出しでも「ご協賛」と区別する
              （個人側は「ご支援くださった皆さま」で、名前が紛らわしい） */}
          <h3 className="mt-12 text-[11px] font-bold tracking-[0.2em] text-nicchyo-ink/40">
            ご協賛くださる皆さま
          </h3>
          <SupporterSlots className="mt-5" />

          {/* 個人の一覧への導線。掲載枠のすぐ下が、探している人がいちばん見る所 */}
          <Link
            href="/support/supporters"
            className="group mt-7 flex items-center justify-between gap-4 border-t border-nicchyo-ink/10 pt-5 transition-colors hover:text-amber-800"
          >
            <span>
              <span className="block text-[14px] font-bold text-amber-700 underline-offset-4 group-hover:underline">
                個人でご支援くださった皆さま
              </span>
              <span className="mt-1 block text-[12.5px] text-nicchyo-ink/45">
                {individualSupporterCount > 0
                  ? `${individualSupporterCount.toLocaleString("ja-JP")}名のお名前を掲載しております`
                  : "これから、こちらにお名前を掲載してまいります"}
              </span>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-amber-700/60 transition group-hover:translate-x-0.5 group-hover:text-amber-700"
              aria-hidden
            />
          </Link>
        </Section>

        {/* ── 届いている範囲 ──────────────────────────────────────────── */}
        <Section label="届いている範囲" title={["日曜市を歩く方に、", "届いております"]}>
          <dl className="flex gap-10 border-b border-nicchyo-ink/[0.07] pb-7 sm:gap-16">
            <Figure label="マップに載っている店舗" value={shopCount} />
            <Figure label="今週の訪問者数" value={weeklyVisitors} />
          </dl>

          <div className="mt-8">
            <TrackRecord />
          </div>

        </Section>

        {/* ── 運営体制 ────────────────────────────────────────────────
            名前を並べた組織図ではなく、お金がどこに入って最後に誰へ届くのかを
            1枚で見せる。「卒業したら誰が続けるのか」がここでの主題 */}
        <Section label="運営体制" title={["ご支援は、", "学生の手で", "日曜市へ届きます"]}>
          <TeamStructure />
        </Section>

        {/* ── ご支援の方法 ────────────────────────────────────────────
            個人と組織では、お返しできるものも決め方も違う。ひとつにまとめると
            どちらの人も自分の話として読めなくなるので、最初から道を分ける */}
        <Section label="ご支援の方法" title={["2つの形で、", "お力添えいただけます"]}>
          <SupportWays
            sponsorUnitAnnualJpy={SPONSOR_UNIT_ANNUAL_JPY}
            sponsorUnitMonths={unitMonths}
            individualSupporterCount={individualSupporterCount}
          />
        </Section>

        {/* ── コードでのご支援 ────────────────────────────────────────
            お金以外の支え方。技術者や学生が「自分にもできることがある」と
            気づける入口。リポジトリは公開しているので、そこへ素直につなぐ */}
        <Section label="コードでのご支援" title={["コードやデザインでも、", "ご参加いただけます"]}>
          <div className="grid gap-3 sm:grid-cols-2">
            {CODE_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-4 rounded-card bg-white p-5 ring-1 ring-nicchyo-ink/[0.08] transition duration-300 ease-out-soft hover:-translate-y-1 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span>
                  <span className="block text-[14px] font-bold text-amber-700">{link.title}</span>
                  <span className="mt-1 block text-[12.5px] leading-relaxed text-nicchyo-ink/50">
                    {link.body}
                  </span>
                </span>
                <ArrowUpRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-700/60 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-amber-700 motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
                  aria-hidden
                />
              </a>
            ))}
          </div>
        </Section>

        {/* ── ご相談について ──────────────────────────────────────────── */}
        <Section label="ご相談について" title={["ご相談の前に、", "お伝えしておきたいこと"]}>
          {/*
            税制の話も先に書いておく。経理の方が後から確認して話が止まるより、
            最初にお伝えした方が誠実で、結果として早く進む
          */}
          <dl className="grid gap-3 sm:grid-cols-3">
            {CONSULT_NOTES.map((note) => (
              <div key={note.title} className="rounded-card bg-white/70 p-5 ring-1 ring-nicchyo-ink/[0.07]">
                <dt className="text-[14px] font-bold">{note.title}</dt>
                <dd className="mt-1.5 text-[12.5px] leading-[1.85] text-nicchyo-ink/55">{note.body}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* 締め。お願いで終わらせず、いま支えてくださっている方への礼で閉じる */}
        <Reveal>
          <p className="border-t border-nicchyo-ink/[0.07] py-12 text-center text-[14px] font-bold leading-[2] text-nicchyo-ink/60 [word-break:auto-phrase] sm:py-16">
            日曜市に関わるみなさまのお力添えで、この地図は続いております。
            <br />
            いつもありがとうございます。
          </p>
        </Reveal>
      </div>

      <SupportFloatingCta heroId={HERO_ID} />
      <NavigationBar />
    </main>
  );
}
