import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from "@/lib/siteLinks";
import NavigationBar from "../../components/NavigationBar";
import { fetchWeeklyVisitors } from "@/lib/analytics/visitorStats.server";
import { fetchPublishedShopCount } from "@/lib/support/shopCount.server";
import SupporterSlots from "@/components/SupporterSlots";
import { SUPPORTER_SLOT_COUNT, SUPPORTERS } from "@/lib/support/supporters";
import SupportHero from "./components/SupportHero";
import SupportFloatingCta from "./components/SupportFloatingCta";
import FundUses from "./components/FundUses";
import TrackRecord from "./components/TrackRecord";
import TeamStructure from "./components/TeamStructure";
import SupportWays from "./components/SupportWays";
import { CountUp, RiseHeading } from "@/components/ScrollMotion";
import Reveal from "@/components/Reveal";
import { Surface } from "@/components/ui";
import { totalIndividualSupporters } from "@/lib/support/individualSupporters";
import { FUND_USES, SPONSOR_UNIT_ANNUAL_JPY } from "./costs";

export const metadata = {
  title: "協賛・ご支援について",
  description:
    "nicchyo へいただいたご支援の使い道と、ご支援いただいている状況をご案内しております。協賛のご相談も承っております。",
  openGraph: {
    title: "協賛・ご支援について | nicchyo",
    description:
      "高知・日曜市の地図 nicchyo は、高知高専の学生と顧問の教員が運営しております。いただいたご支援は、ドメイン代や開発・運用の費用、AIの利用料など、nicchyo を続けるために使わせていただきます。",
  },
};

/** ご支援の使い道の節。入口の「ご支援の使い道を見る」の飛び先 */
const USES_SECTION_ID = "uses";

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

/** 締めの礼。文節ごとに区切り、狭い画面では切れ目で折り返す */
const CLOSING_LINES = [
  "日曜市に出店されているみなさま、",
  "高知市商業振興課のみなさまをはじめ、",
  "日曜市に関わるみなさまのお力添えで、",
  "この地図は続いております。",
  "いつもありがとうございます。",
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
    body: "お預かりした資金は、nicchyo を続けるため以外には使用いたしません。会計は顧問の教員が確認しております。",
  },
];

/**
 * 1つの節。小さな見出し（何の話か）の下に、言い切りの見出し（何が言いたいか）を置く。
 *
 * 見出しだけを拾い読みしても、このページの話がひと通りつながるように書くこと。
 * 本文は見出しを裏づける中身に絞り、説明の文章はなるべく足さない。
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
      <p className="text-[11px] font-bold tracking-[0.2em] text-amber-700">{label}</p>
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

  const individualSupporterCount = totalIndividualSupporters();
  // 掲載枠に空きがあるあいだは、探していることをそのまま見出しにする
  const hasOpenSlot = SUPPORTERS.length < SUPPORTER_SLOT_COUNT;

  return (
    <main
      className="support-page min-h-screen bg-nicchyo-base text-nicchyo-ink"
      // 右下のボタンが最後の行に重ならないよう、そのぶんも空けておく
      style={{ paddingBottom: "calc(var(--nav-bar-height) + var(--safe-bottom, 0px) + 5.5rem)" }}
    >
      <SupportHero usesId={USES_SECTION_ID} />

      <div className="mx-auto max-w-[64rem] px-6 sm:px-8">
        {/* ── ご支援の使い道 ──────────────────────────────────────────
            運営にいくらかかるかは出さない（costs.ts の冒頭）。何に使うかを約束として出す */}
        <Section
          id={USES_SECTION_ID}
          label="ご支援の使い道"
          title={["いただいたご支援は、", "nicchyo を続けるために", "使わせていただきます"]}
        >
          <FundUses uses={FUND_USES} />
        </Section>

        {/* ── いまの状況 ─────────────────────────────────────────────── */}
        <Section
          label="いまの状況"
          title={
            hasOpenSlot
              ? ["続けていくための", "ご協賛を、", "探しております"]
              : ["ご協賛くださる皆さまに、", "支えていただいております"]
          }
        >
          {/* 個人のご支援は別のページなので、見出しでも「ご協賛」と区別する
              （個人側は「ご支援くださった皆さま」で、名前が紛らわしい） */}
          <h3 className="text-[11px] font-bold tracking-[0.2em] text-nicchyo-ink/70">
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
              <span className="mt-1 block text-[12.5px] text-nicchyo-ink/70">
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
        <Section label="届いている範囲" title={["日曜市の地図として、", "使っていただいております"]}>
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
        <Section label="運営体制" title={["学生がつくり、", "顧問の教員が見守って、", "日曜市へ届けております"]}>
          <TeamStructure />
        </Section>

        {/* ── ご支援の方法 ────────────────────────────────────────────
            個人と組織では、お返しできるものも決め方も違う。ひとつにまとめると
            どちらの人も自分の話として読めなくなるので、最初から道を分ける */}
        <Section label="ご支援の方法" title={["個人でも、", "組織・企業でも、", "お力添えいただけます"]}>
          <SupportWays
            sponsorUnitAnnualJpy={SPONSOR_UNIT_ANNUAL_JPY}
            individualSupporterCount={individualSupporterCount}
          />
        </Section>

        {/* ── ご相談について ──────────────────────────────────────────── */}
        <Section label="ご相談について" title={["ご相談の前に、", "お伝えしておきたいこと"]}>
          {/*
            税制の話も先に書いておく。経理の方が後から確認して話が止まるより、
            最初にお伝えした方が誠実で、結果として早く進む
          */}
          <dl className="grid gap-3 sm:grid-cols-3">
            {CONSULT_NOTES.map((note) => (
              <Surface key={note.title} elevation="flat">
                <dt className="text-[14px] font-bold">{note.title}</dt>
                <dd className="mt-1.5 text-[12.5px] leading-[1.85] text-nicchyo-ink/70">{note.body}</dd>
              </Surface>
            ))}
          </dl>
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
                className="group flex items-start justify-between gap-4 rounded-card bg-white p-5 ring-1 ring-nicchyo-ink/[0.08] transition duration-300 ease-out-soft hover:-translate-y-1 hover:shadow-card motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span>
                  <span className="block text-[14px] font-bold text-amber-700">{link.title}</span>
                  <span className="mt-1 block text-[12.5px] leading-relaxed text-nicchyo-ink/70">
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

        {/* 締め。お願いで終わらせず、いま支えてくださっている方への礼で閉じる */}
        <Reveal>
          {/* 出店者と市の担当課には、お金以外の面で支えていただいている。名前を挙げて礼を言う */}
          <p className="border-t border-nicchyo-ink/[0.07] py-12 text-center text-[14px] font-bold leading-[2] text-nicchyo-ink/70 sm:py-16">
            {CLOSING_LINES.map((line) => (
              <span key={line} className="inline-block">
                {line}
              </span>
            ))}
          </p>
        </Reveal>
      </div>

      <SupportFloatingCta />
      <NavigationBar />
    </main>
  );
}
