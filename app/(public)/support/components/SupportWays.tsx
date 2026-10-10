import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import Reveal from "@/components/Reveal";
import { buttonClass } from "@/components/ui";
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
 *
 * 説明は1項目1文までに留める。ここは読み物ではなく、2つを見比べて選ぶ場所。
 */

type Offer = {
  title: string;
  body: string;
};

/**
 * 組織・企業のご協賛でお返しできること。
 *
 * ここに書いた時点で約束になるので、部員が入れ替わっても手をかけずに続くもの
 * 以外は足さないこと。
 *
 * ★「ご紹介の効果を、数字でご確認いただけます」だけは、まだ画面が無い。
 *   計測そのものは guide_events で動いていて（spot_key ごとに open /
 *   navigation_start / arrived を匿名の visitor_key で記録している）、
 *   足りないのは協賛者用のアカウントと閲覧画面だけ。
 *   最初のご協賛をお受けするまでに用意すること。間に合わないなら、先にこの
 *   項目を消すこと。
 */
const SPONSOR_OFFERS: Offer[] = [
  {
    title: "お名前またはロゴの掲載",
    body: "このページと「nicchyoとは」に掲載いたします。",
  },
  {
    title: "支えていただいた分を、図でお示しします",
    body: "ご希望に応じて、上の図にご協賛ぶんの色がつきます。",
  },
  {
    title: "マップへのご紹介",
    body: "ご希望に応じて、日曜市の周辺で立ち寄れる場所としてご紹介いたします。",
  },
  {
    title: "ご紹介の効果を、数字でご確認いただけます",
    body: "専用のアカウントで、ご覧になった方とお越しになった方の数をいつでもご確認いただけます。個人が特定される情報は含みません。",
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

type SupportWaysProps = {
  /** 協賛1口の年額。未定なら組織側の金額欄を出さない */
  sponsorUnitAnnualJpy: number | null;
  /** 1口が何ヶ月ぶんにあたるか */
  sponsorUnitMonths: number | null;
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
            <span className="mt-0.5 block text-[12.5px] leading-[1.8] text-nicchyo-ink/55">
              {offer.body}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 2枚に共通の形。持ち上がるのは、指やカーソルが乗ったときだけ */
const CARD_CLASS =
  "flex h-full flex-col rounded-card p-6 transition duration-300 ease-out-soft hover:-translate-y-1 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-7";

export default function SupportWays({
  sponsorUnitAnnualJpy,
  sponsorUnitMonths,
  individualSupporterCount,
}: SupportWaysProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      {/* ── 個人の方 ───────────────────────────────────────────── */}
      <Reveal className="h-full">
        <div className={`${CARD_CLASS} bg-white ring-1 ring-nicchyo-ink/[0.08]`}>
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

          <OfferList offers={INDIVIDUAL_OFFERS} markClassName="bg-nicchyo-ink/[0.08] text-nicchyo-ink/60" />

          {/* 枠の高さがそろうよう、ボタンは下に寄せる */}
          <div className="mt-auto pt-7">
            <Link
              href="/contact?category=sponsor"
              className={buttonClass({ variant: "ink", size: "lg", className: "w-full" })}
            >
              ご支援のご相談
            </Link>
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
          </div>
        </div>
      </Reveal>

      {/* ── 組織・企業の方 ─────────────────────────────────────── */}
      <Reveal className="h-full" delay={0.12}>
        <div className={`${CARD_CLASS} bg-amber-50/70 ring-1 ring-amber-600/15`}>
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

          <OfferList offers={SPONSOR_OFFERS} markClassName="bg-amber-500 text-white" />

          <div className="mt-auto pt-7">
            <Link
              href="/contact?category=sponsor"
              className={buttonClass({ variant: "ink", size: "lg", className: "w-full" })}
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
      </Reveal>
    </div>
  );
}
