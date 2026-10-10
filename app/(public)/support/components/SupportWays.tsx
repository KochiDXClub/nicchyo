import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import Reveal from "@/components/Reveal";
import { buttonClass } from "@/components/ui";
import { formatJpy, supportContactHref } from "../costs";

/**
 * ご支援の2つの道と、お申し込みの流れ
 *
 * 個人と組織では、お返しできるものも、決め方も違う。ひとつの説明にまとめると
 * どちらの人も自分の話として読めなくなるので、最初から2つに分ける。
 * 中心は個人のご支援。組織・企業にも同じ流れでご支援いただき、お返しは
 * お名前の掲載とご報告に留める（広告にあたるお返しはしない）。
 *
 * 違いは文章で説明しない。同じ形の枠を2つ並べて「金額 → お返しできること →
 * 進む先」の順番を揃えれば、横に読むだけで差が出る。
 *
 * 面の色を変えてあるのは、額の大小ではなく性質の違いを示すため。
 * 組織は掲載枠と期間のある取り決め、個人はお気持ちのご支援。
 * どちらが上ということはないので、大きさと構造は完全に同じにしている。
 *
 * サイト内に決済が無いぶん、「押したあと何が起きるか」が読み手のいちばんの不安になる。
 * カードの下に、ご相談から掲載までの流れを置いて先に答えておく。
 */

type Offer = {
  title: string;
  body: string;
};

/**
 * 組織・企業のご支援でお返しできること。
 *
 * ここに書いた時点で約束になるので、部員が入れ替わっても手をかけずに続くもの
 * 以外は足さないこと。マップへの掲載のような、広告にあたるお返しは足さない
 * （入口で「広告は掲載せず」と書いているのと食い違ううえ、寄附として受けられなくなる）。
 */
const ORGANIZATION_OFFERS: Offer[] = [
  {
    title: "お名前またはロゴの掲載",
    body: "このページと「nicchyoとは」に1年間掲載いたします。",
  },
  {
    title: "活動のご報告と、ご継続のご相談",
    body: "期間が終わる前に、1年間の活動をまとめてご報告し、こちらからご連絡いたします。",
  },
];

/** 個人のご支援でお返しできること */
const INDIVIDUAL_OFFERS: Offer[] = [
  {
    title: "お名前の掲載",
    body: "ご希望の方は「ご支援くださった皆さま」に掲載いたします。ニックネームでも構いません。",
  },
  {
    title: "金額は表に出しません",
    body: "お名前は、金額の多少にかかわらず同じ大きさで並べております。",
  },
  {
    title: "掲載に期限はありません",
    body: "取り下げをご希望の際は、いつでも承ります。",
  },
];

/**
 * ご相談から掲載までの流れ。
 *
 * お振込先は書かない。受け取り方を変えたときに、ページと実際の案内が食い違わない
 * よう、ご相談のあとに個別にご案内する。
 */
const FLOW_STEPS: Offer[] = [
  { title: "ご相談", body: "お問い合わせ箱から、お気軽にご連絡ください。" },
  { title: "ご案内", body: "運営からお返事し、お振込の方法をご案内いたします。" },
  { title: "お振込", body: "ご案内した方法で、お振込みをお願いいたします。" },
  { title: "掲載", body: "ご希望の方のお名前を掲載いたします。" },
];

type SupportWaysProps = {
  /** 1口の年額。未定なら組織側の金額欄を出さない */
  sponsorUnitAnnualJpy: number | null;
  /** 組織・企業の掲載枠の空き */
  openSlotCount: number;
  /** これまでに個人でご支援くださった方の人数 */
  individualSupporterCount: number;
};

function OfferList({ offers, markClassName }: { offers: Offer[]; markClassName: string }) {
  return (
    <ul className="mt-6 space-y-3.5">
      {offers.map((offer) => (
        <li key={offer.title} className="flex gap-3">
          <span
            className={`mt-[0.2rem] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-chip ${markClassName}`}
            aria-hidden
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <span>
            <strong className="block text-[14px] font-bold leading-snug">{offer.title}</strong>
            <span className="mt-0.5 block text-[12.5px] leading-[1.8] text-nicchyo-ink/70">
              {offer.body}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 2枚に共通の形。カードそのものは押せないので、乗っても浮かせない */
const CARD_CLASS = "flex h-full flex-col rounded-card p-6 sm:p-7";

export default function SupportWays({
  sponsorUnitAnnualJpy,
  openSlotCount,
  individualSupporterCount,
}: SupportWaysProps) {
  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        {/* ── 個人の方 ───────────────────────────────────────────── */}
        <Reveal className="h-full">
          <div className={`${CARD_CLASS} bg-white ring-1 ring-nicchyo-ink/[0.08]`}>
            <p className="text-[11px] font-bold tracking-[0.14em] text-nicchyo-ink/70">個人の方</p>

            {/* 金額の位置を組織側とそろえる。ここが横に並ぶことで差が読める */}
            <p className="mt-4 flex items-baseline gap-2">
              <span className="text-[1.7rem] font-bold leading-none">お気持ちで</span>
            </p>
            <p className="mt-2 text-[12.5px] text-nicchyo-ink/70">
              金額は問いません
              {individualSupporterCount > 0 &&
                `・これまでに ${individualSupporterCount.toLocaleString("ja-JP")}名`}
            </p>

            <OfferList
              offers={INDIVIDUAL_OFFERS}
              markClassName="bg-nicchyo-ink/[0.08] text-nicchyo-ink/60"
            />

            {/* 枠の高さがそろうよう、ボタンは下に寄せる */}
            <div className="mt-auto pt-7">
              <Link
                href={supportContactHref("individual")}
                // 見えているあいだ、右下の同じボタンは引っ込む（SupportFloatingCta）
                data-support-cta
                className={buttonClass({ variant: "ink", size: "lg", className: "w-full" })}
              >
                ご支援のご相談
              </Link>
              {/* まだ誰も載っていない一覧へは送らない。空の一覧は「誰も支援していない」に見える */}
              {individualSupporterCount > 0 && (
                <Link
                  href="/support/supporters"
                  className="group mt-3 flex items-center justify-center gap-1.5 text-[12.5px] font-bold text-amber-700 underline-offset-4 transition hover:text-amber-800 hover:underline"
                >
                  ご支援くださった皆さまを見る
                  <ArrowRight
                    className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
                    aria-hidden
                  />
                </Link>
              )}
            </div>
          </div>
        </Reveal>

        {/* ── 組織・企業の方 ─────────────────────────────────────── */}
        <Reveal className="h-full" delay={0.12}>
          <div className={`${CARD_CLASS} bg-amber-50/70 ring-1 ring-amber-600/15`}>
            <p className="text-[11px] font-bold tracking-[0.14em] text-amber-700">組織・企業の方</p>

            <p className="mt-4 flex items-baseline gap-2">
              <span className="text-[1.7rem] font-bold leading-none tabular-nums">
                {sponsorUnitAnnualJpy === null
                  ? "ご相談のうえ"
                  : `1口 ${formatJpy(sponsorUnitAnnualJpy)}`}
              </span>
              {sponsorUnitAnnualJpy !== null && (
                <span className="text-[13px] font-bold text-nicchyo-ink/70">/ 年</span>
              )}
            </p>
            <p className="mt-2 text-[12.5px] tabular-nums text-nicchyo-ink/70">
              掲載は1年間
              {openSlotCount > 0 && `・掲載枠はあと${openSlotCount}つ`}
            </p>

            <OfferList offers={ORGANIZATION_OFFERS} markClassName="bg-amber-500 text-white" />

            <div className="mt-auto pt-7">
              <Link
                href={supportContactHref("organization")}
                // 見えているあいだ、右下の同じボタンは引っ込む（SupportFloatingCta）
                data-support-cta
                className={buttonClass({ variant: "ink", size: "lg", className: "w-full" })}
              >
                ご支援のご相談
              </Link>
              {sponsorUnitAnnualJpy !== null && (
                <p className="mt-3 text-center text-[12px] leading-relaxed text-nicchyo-ink/70">
                  1口の金額は年に一度見直させていただきます
                </p>
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {/* ── お申し込みの流れ ──────────────────────────────────────── */}
      <h3 className="mt-12 text-[11px] font-bold tracking-[0.2em] text-nicchyo-ink/70">
        お申し込みの流れ
      </h3>
      <ol className="mt-5 grid gap-3 sm:grid-cols-4">
        {FLOW_STEPS.map((step, index) => (
          <li key={step.title}>
            <Reveal className="h-full" delay={index * 0.1}>
              <div className="flex h-full gap-3.5 rounded-card bg-white/70 p-4 ring-1 ring-nicchyo-ink/[0.07] sm:block">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-chip bg-nicchyo-ink text-[12px] font-bold tabular-nums text-white"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="block sm:mt-3">
                  <span className="block text-[14px] font-bold">{step.title}</span>
                  <span className="mt-1 block text-[12.5px] leading-[1.8] text-nicchyo-ink/70">
                    {step.body}
                  </span>
                </span>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </div>
  );
}
