import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatJpy } from "../costs";

/**
 * ご支援の2つの道
 *
 * 個人と組織では、お返しできるものも、決め方も違う。ひとつの説明にまとめると
 * どちらの人も自分の話として読めなくなるので、最初から2つに分ける。
 *
 * 違いは文章で説明しない。同じ形の枠を2つ並べて「金額 → お返しできること →
 * 進む先」の順番を揃えれば、横に読むだけで差が出る。
 *
 * 面の色を変えてあるのは、額の大小ではなく性質の違いを示すため。
 * 組織は掲載枠と期間のある取り決め、個人はお気持ちのご支援。
 * どちらが上ということはないので、大きさと構造は完全に同じにしている。
 */

type Offer = {
  title: string;
  body: string;
};

/**
 * 組織・企業のご協賛でお返しできること。
 *
 * すでに実装してあるものだけを並べる。ここに書いた時点で約束になるので、
 * 部員が入れ替わっても手をかけずに続くもの以外は足さないこと。
 */
const SPONSOR_OFFERS: Offer[] = [
  {
    title: "お名前またはロゴの掲載",
    body: "このページと「nicchyoとは」に掲載いたします。",
  },
  {
    title: "支えていただいた分を、図でお示しします",
    body: "ご希望に応じて、上の図にご協賛ぶんの色がつきます。何ヶ月ぶんを支えていただいているかが、そのまま見える形になります。",
  },
  {
    title: "マップへのご紹介",
    body: "ご希望に応じて、日曜市の周辺で立ち寄れる場所として、マップにご紹介いたします。",
  },
  {
    title: "更新のご相談",
    body: "期間が終わる前に、こちらからご連絡いたします。",
  },
];

/** 個人のご支援でお返しできること */
const INDIVIDUAL_OFFERS: Offer[] = [
  {
    title: "お名前の掲載",
    body: "ご希望の方は「ご支援くださった皆さま」にお名前を掲載いたします。ニックネームでも構いません。",
  },
  {
    title: "金額は表に出しません",
    body: "おいくらいただいたかは掲載いたしません。お名前は、金額の多少にかかわらず同じ大きさで並べております。",
  },
];

type SupportWaysProps = {
  /** 協賛1口の年額。未定なら組織側の金額欄を出さない */
  sponsorUnitAnnualJpy: number | null;
  /** 1口が何ヶ月ぶんにあたるか */
  sponsorUnitMonths: number | null;
  /** これまでに個人でご支援くださった方の人数 */
  individualSupporterCount: number;
};

function OfferList({ offers, dotClassName }: { offers: Offer[]; dotClassName: string }) {
  return (
    <ul className="mt-6 space-y-4">
      {offers.map((offer) => (
        <li key={offer.title} className="flex gap-3.5">
          <span className={`mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full ${dotClassName}`} aria-hidden />
          <span>
            <strong className="block text-[14.5px] font-bold">{offer.title}</strong>
            <span className="mt-1 block text-[13px] leading-[1.95] text-nicchyo-ink/60">
              {offer.body}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function SupportWays({
  sponsorUnitAnnualJpy,
  sponsorUnitMonths,
  individualSupporterCount,
}: SupportWaysProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      {/* ── 個人の方 ───────────────────────────────────────────── */}
      <div className="flex flex-col rounded-[22px] bg-white p-6 ring-1 ring-nicchyo-ink/[0.08] sm:p-7">
        <p className="text-[11px] font-bold tracking-[0.14em] text-nicchyo-ink/40">個人の方</p>

        {/* 金額の位置を組織側とそろえる。ここが横に並ぶことで差が読める */}
        <p className="mt-4 flex items-baseline gap-2">
          <span className="text-[1.7rem] font-bold leading-none">お気持ちで</span>
        </p>
        <p className="mt-2 text-[12.5px] text-nicchyo-ink/45">
          金額は問いません
          {individualSupporterCount > 0 &&
            `・これまでに ${individualSupporterCount.toLocaleString("ja-JP")}名`}
        </p>

        <OfferList offers={INDIVIDUAL_OFFERS} dotClassName="bg-nicchyo-ink/30" />

        {/* 枠の高さがそろうよう、ボタンは下に寄せる */}
        <div className="mt-auto pt-7">
          <Link
            href="/contact?category=sponsor"
            className="flex w-full items-center justify-center rounded-2xl bg-nicchyo-ink px-4 py-3.5 text-[14.5px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(58,58,58,0.55)] transition hover:bg-nicchyo-ink/90 active:scale-[0.99]"
          >
            ご支援のご相談
          </Link>
          <Link
            href="/support/supporters"
            className="group mt-3 flex items-center justify-center gap-1.5 text-[12.5px] font-bold text-amber-700 underline-offset-4 transition hover:text-amber-800 hover:underline"
          >
            ご支援くださった皆さまを見る
            <ArrowRight
              className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>
      </div>

      {/* ── 組織・企業の方 ─────────────────────────────────────── */}
      <div className="flex flex-col rounded-[22px] bg-amber-50/70 p-6 ring-1 ring-amber-600/15 sm:p-7">
        <p className="text-[11px] font-bold tracking-[0.14em] text-amber-700">組織・企業の方</p>

        <p className="mt-4 flex items-baseline gap-2">
          <span className="text-[1.7rem] font-bold leading-none tabular-nums">
            {sponsorUnitAnnualJpy === null ? "ご相談のうえ" : `1口 ${formatJpy(sponsorUnitAnnualJpy)}`}
          </span>
          {sponsorUnitAnnualJpy !== null && (
            <span className="text-[13px] font-bold text-nicchyo-ink/40">/ 年</span>
          )}
        </p>
        <p className="mt-2 text-[12.5px] tabular-nums text-nicchyo-ink/45">
          掲載は1年間
          {sponsorUnitMonths !== null &&
            `・運営費のおよそ ${sponsorUnitMonths.toFixed(1)}ヶ月分にあたります`}
        </p>

        <OfferList offers={SPONSOR_OFFERS} dotClassName="bg-amber-600" />

        <div className="mt-auto pt-7">
          <Link
            href="/contact?category=sponsor"
            className="flex w-full items-center justify-center rounded-2xl bg-nicchyo-ink px-4 py-3.5 text-[14.5px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(58,58,58,0.55)] transition hover:bg-nicchyo-ink/90 active:scale-[0.99]"
          >
            協賛のご相談
          </Link>
          {sponsorUnitAnnualJpy !== null && (
            <p className="mt-3 text-center text-[12px] leading-relaxed text-nicchyo-ink/40">
              1口の金額は年に一度見直させていただきます
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
