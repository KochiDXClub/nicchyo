import Link from "next/link";
import { ArrowRight } from "lucide-react";
import NavigationBar from "../../components/NavigationBar";
import { fetchPublishedShopCount } from "@/lib/support/shopCount.server";
import SupporterSlots from "@/components/SupporterSlots";
import { SUPPORTER_SLOT_COUNT, SUPPORTERS } from "@/lib/support/supporters";
import { getActivityBySlug } from "@/app/data/activities";
import SupportHero from "./components/SupportHero";
import SupportFloatingCta from "./components/SupportFloatingCta";
import FundUses from "./components/FundUses";
import SupportWays from "./components/SupportWays";
import SupportGallery from "./components/SupportGallery";
import { CountUp, RiseHeading } from "@/components/ScrollMotion";
import Reveal from "@/components/Reveal";
import { Surface } from "@/components/ui";
import { totalIndividualSupporters } from "@/lib/support/individualSupporters";
import { FUND_USES, SPONSOR_UNIT_ANNUAL_JPY } from "./costs";

export const metadata = {
  title: "協賛・ご支援について",
  description:
    "nicchyo へいただいたご支援の使い道と、ご支援の方法をご案内しております。個人の方からも、組織・企業の方からも承っております。",
  openGraph: {
    title: "協賛・ご支援について | nicchyo",
    description:
      "高知・日曜市の地図 nicchyo は、高知高専の学生と顧問の教員が運営しております。いただいたご支援は、ドメイン代や開発・運用の費用、AIの利用料など、nicchyo を続けるために使わせていただきます。",
  },
};

/** ご支援の使い道の節。入口の「ご支援の使い道を見る」の飛び先 */
const USES_SECTION_ID = "uses";

/**
 * 入口に札として出す実績。取り組みの記録（app/data/activities.ts）の slug で指す。
 * 名前は記録の側から引くので、ここで書き写さない。見つからない slug は出さない
 */
const HIGHLIGHT_ACTIVITY_SLUGS = ["2026-02-28-kochi-npo-award", "2025-07-31-re-kosen-adopted"];

/**
 * 日曜市そのものの規模。nicchyo の利用者数ではなく、案内している市の大きさ。
 * 協賛を考える側には、週ごとに 0 へ戻る訪問者数より、こちらの方が判断の材料になる
 */
const MARKET_VISITORS_PER_DAY = 17_000;

/** 締めの礼。文節ごとに区切り、狭い画面では切れ目で折り返す */
const CLOSING_LINES = [
  "日曜市に出店されているみなさま、",
  "高知市商業振興課のみなさまをはじめ、",
  "日曜市に関わるみなさまのお力添えで、",
  "この地図は続いております。",
  "いつもありがとうございます。",
];

/**
 * ご相談の前にお伝えしておくこと。
 *
 * 税制の扱いは、受け取り方（学校の寄附金の窓口を通すか）が決まるまで今の書き方の
 * ままにしておく。決まったら、学校に確認した内容に合わせて書き換えること。
 */
const CONSULT_NOTES = [
  {
    title: "お支払いについて",
    body: "サイト内での決済は承っておりません。お振込の方法は、ご相談のあとにご案内いたします。",
  },
  {
    title: "税制上の優遇について",
    body: "恐れ入りますが、寄附金控除などの税制上の優遇の対象にはなりません。あらかじめご了承いただけますと幸いです。",
  },
  {
    title: "運営と会計について",
    body: "高知高専の学生が開発・運営し、会計は顧問の教員が確認しております。お預かりした資金は、nicchyo を続けるため以外には使用いたしません。",
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
 *
 * 本文の幅はふつう本文の枠（CONTAINER）に収める。写真の帯のように画面の端まで
 * 使いたいものだけ bleed を付ける。見出しと区切りの線は、どちらでも枠の中に置く。
 */
const CONTAINER = "mx-auto max-w-[64rem] px-6 sm:px-8";

function Section({
  id,
  label,
  title,
  bleed = false,
  className = "",
  children,
}: {
  id?: string;
  label: string;
  /** 文節ごとに区切った見出し。1つあたり12文字までにしておくと、どの幅でも収まる */
  title: string[];
  /** 本文を画面の端まで広げる */
  bleed?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const body = (
    <Reveal className="mt-7 sm:mt-9" delay={0.1}>
      {children}
    </Reveal>
  );

  return (
    <section id={id} className={`scroll-mt-24 pb-12 sm:pb-16 ${className}`}>
      <div className={CONTAINER}>
        <div className="border-t border-nicchyo-ink/[0.07] pt-12 sm:pt-16">
          <p className="text-[11px] font-bold tracking-[0.2em] text-amber-700">{label}</p>
          <RiseHeading className="mt-3 text-[1.4rem] font-bold leading-[1.55] tracking-tight sm:text-[1.75rem]">
            {title.map((phrase) => (
              <span key={phrase} className="inline-block">
                {phrase}
              </span>
            ))}
          </RiseHeading>
        </div>
        {!bleed && body}
      </div>
      {bleed && body}
    </section>
  );
}

/** 数字ひとつ。取れなかったときは「集計中」に落とす */
function Figure({ label, value, note }: { label: string; value: number | null; note?: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.08em] text-nicchyo-ink/70">{label}</dt>
      <dd className="mt-2 text-[2.2rem] font-bold leading-none tabular-nums sm:text-[2.6rem]">
        {value === null ? (
          <span className="text-[15px] font-bold text-nicchyo-ink/50">集計中</span>
        ) : (
          <CountUp value={value} delay={0.2} />
        )}
      </dd>
      {note && <dd className="mt-2 text-[11.5px] text-nicchyo-ink/70">{note}</dd>}
    </div>
  );
}

export default async function SupportPage() {
  const shopCount = await fetchPublishedShopCount();

  const individualSupporterCount = totalIndividualSupporters();
  const openSlotCount = Math.max(SUPPORTER_SLOT_COUNT - SUPPORTERS.length, 0);
  const highlights = HIGHLIGHT_ACTIVITY_SLUGS.flatMap((slug) => {
    const activity = getActivityBySlug(slug);
    return activity ? [activity.title] : [];
  });

  return (
    <main
      className="support-page min-h-screen bg-nicchyo-base text-nicchyo-ink"
      // 右下のボタンが最後の行に重ならないよう、そのぶんも空けておく
      style={{ paddingBottom: "calc(var(--nav-bar-height) + var(--safe-bottom, 0px) + 5.5rem)" }}
    >
      <SupportHero usesId={USES_SECTION_ID} highlights={highlights} />

      {/* ── ご支援の使い道 ──────────────────────────────────────────
          運営にいくらかかるかは出さない（costs.ts の冒頭）。何に使うかを約束として出す */}
      <Section
        id={USES_SECTION_ID}
        label="ご支援の使い道"
        title={["いただいたご支援は、", "nicchyo を続けるために", "使わせていただきます"]}
      >
        <FundUses uses={FUND_USES} />
      </Section>

      {/* ── 届いている範囲 ──────────────────────────────────────────── */}
      <Section label="届いている範囲" title={["日曜市を訪れるみなさまを、", "ご案内しております"]}>
        <dl className="flex flex-wrap gap-x-12 gap-y-6 sm:gap-x-16">
          <Figure label="マップに載っている店舗" value={shopCount} />
          <Figure
            label="日曜市を訪れる方"
            value={MARKET_VISITORS_PER_DAY}
            note="1回あたりおよそ（高知市調べ）"
          />
        </dl>

        <Link
          href="/activities"
          className="group mt-8 inline-flex items-center gap-1.5 text-[13px] font-bold text-amber-700 underline-offset-4 transition hover:text-amber-800 hover:underline"
        >
          これまでの取り組みを見る
          <ArrowRight
            className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
            aria-hidden
          />
        </Link>
      </Section>

      {/* ── 活動の様子 ──────────────────────────────────────────────
          学生のプロジェクトにお金を出してよいかを決める人に、実際に日曜市へ
          通っている人がいることを写真で見せる。帯は画面の端まで流す。
          紙には要らない（流れる帯は1枚の写真として読めない）ので印刷では外す */}
      <Section
        label="活動の様子"
        title={["これまでの活動を、", "写真でご紹介いたします"]}
        bleed
        className="print:hidden"
      >
        <SupportGallery />
      </Section>

      {/* ── ご協賛くださる皆さま ──────────────────────────────────────
          まだ1件も無いあいだは節ごと出さない。空の枠が並ぶと「誰も支援していない」に
          見えるため。空きの数は「ご支援の方法」の組織・企業のカードに添えてある */}
      {SUPPORTERS.length > 0 && (
        <Section
          label="ご協賛くださる皆さま"
          title={["ご協賛くださる皆さまに、", "支えていただいております"]}
        >
          <SupporterSlots />
        </Section>
      )}

      {/* ── ご支援の方法 ────────────────────────────────────────────
          個人と組織では、お返しできるものも決め方も違う。ひとつにまとめると
          どちらの人も自分の話として読めなくなるので、最初から道を分ける */}
      <Section label="ご支援の方法" title={["個人でも、", "組織・企業でも、", "お力添えいただけます"]}>
        <SupportWays
          sponsorUnitAnnualJpy={SPONSOR_UNIT_ANNUAL_JPY}
          openSlotCount={openSlotCount}
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

      {/* 締め。お願いで終わらせず、いま支えてくださっている方への礼で閉じる */}
      <Reveal className={CONTAINER}>
        {/* 出店者と市の担当課には、お金以外の面で支えていただいている。名前を挙げて礼を言う */}
        <p className="border-t border-nicchyo-ink/[0.07] py-12 text-center text-[14px] font-bold leading-[2] text-nicchyo-ink/70 sm:py-16">
          {CLOSING_LINES.map((line) => (
            <span key={line} className="inline-block">
              {line}
            </span>
          ))}
        </p>
      </Reveal>

      <SupportFloatingCta />
      <NavigationBar />
    </main>
  );
}
