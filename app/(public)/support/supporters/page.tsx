import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NavigationBar from "../../../components/NavigationBar";
import {
  ANONYMOUS_SUPPORTER_COUNT,
  formatMonth,
  groupSupportersByYear,
  totalIndividualSupporters,
} from "@/lib/support/individualSupporters";

/**
 * 個人でご支援くださった方のお名前
 *
 * 企業の協賛枠と同じ画面に混ぜない。枠とロゴの並びに個人のお名前を入れると、
 * 金額の大小がそのまま見た目の差になってしまう。
 * ここはお名前を等しく並べるだけの場所にして、順番も金額ではなく時系列にする。
 */

export const metadata = {
  title: "ご支援くださった皆さま",
  description:
    "nicchyo を個人でご支援くださった皆さまのお名前です。掲載に同意をいただいた方のみ記載しております。",
  openGraph: {
    title: "ご支援くださった皆さま | nicchyo",
    description: "nicchyo を個人でご支援くださった皆さまのお名前です。",
  },
};

export default function IndividualSupportersPage() {
  const yearGroups = groupSupportersByYear();
  const total = totalIndividualSupporters();

  return (
    <main
      className="support-page min-h-screen bg-nicchyo-base text-nicchyo-ink"
      style={{ paddingBottom: "calc(var(--nav-bar-height) + var(--safe-bottom, 0px) + 2rem)" }}
    >
      <div className="mx-auto max-w-[44rem] px-6 pt-12 sm:px-8 lg:pt-16">
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-nicchyo-ink/45 transition hover:text-nicchyo-ink/75"
        >
          <ArrowLeft className="h-4 w-4" />
          協賛・ご支援について に戻る
        </Link>

        <h1 className="mt-8 text-[1.7rem] font-bold leading-[1.5] tracking-tight sm:text-[2rem]">
          ご支援くださった皆さま
        </h1>
        <p className="mt-4 max-w-[34rem] text-[14px] leading-[2] text-nicchyo-ink/60">
          個人でご支援くださった皆さまです。掲載に同意をいただいた方のみ、お名前を記載しております。
          {total > 0 && `これまでに ${total.toLocaleString("ja-JP")}名のご支援をいただきました。`}
        </p>

        {yearGroups.length > 0 ? (
          /* 年で区切る。期限を切らずに積み上げていくので、増えるほど
             「続いてきた長さ」が並びに出る */
          <div className="mt-12 space-y-10">
            {yearGroups.map((group) => (
              <section key={group.year}>
                <h2 className="text-[11px] font-bold tracking-[0.2em] text-nicchyo-ink/40">
                  {group.year}年
                </h2>
                <ul className="mt-4 border-t border-nicchyo-ink/10">
                  {group.supporters.map((supporter) => (
                    <li
                      key={`${supporter.name}-${supporter.since}`}
                      className="border-b border-nicchyo-ink/[0.07] py-4"
                    >
                      <div className="flex items-baseline justify-between gap-5">
                        <span className="text-[15px] font-bold">{supporter.name}</span>
                        <span className="shrink-0 text-[11.5px] tabular-nums text-nicchyo-ink/40">
                          {formatMonth(supporter.since)}
                        </span>
                      </div>
                      {supporter.message && (
                        <p className="mt-1.5 text-[13px] leading-[1.9] text-nicchyo-ink/55">
                          {supporter.message}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          /* まだお一人もいない状態。空欄のまま置かず、これからであることを書く */
          <p className="mt-12 rounded-[18px] bg-amber-50/70 px-6 py-8 text-center text-[13.5px] leading-[2] text-nicchyo-ink/55 ring-1 ring-amber-600/15">
            これから、こちらにお名前を掲載してまいります。
          </p>
        )}

        {ANONYMOUS_SUPPORTER_COUNT > 0 && (
          <p className="mt-5 text-[13px] text-nicchyo-ink/45">
            このほか、お名前の掲載を希望されなかった {ANONYMOUS_SUPPORTER_COUNT}
            名の方にご支援をいただいております。
          </p>
        )}

        <div className="mt-14 space-y-3 border-t border-nicchyo-ink/10 pt-8 text-[13px] leading-[2] text-nicchyo-ink/50">
          <p>
            一度いただいたお名前は、期限を切らずに掲載し続けます。金額の多少にかかわらず、同じ大きさで並べております。いつもありがとうございます。
          </p>
          {/* 「ずっと掲載する」は「取り下げられない」ではない。同意にもとづいて
              公開している個人情報なので、逃げ道を必ず書いておく */}
          <p className="text-nicchyo-ink/40">
            掲載の取り下げをご希望の際は、いつでもお問い合わせ箱よりお知らせください。
          </p>
        </div>

        <div className="py-12">
          <Link
            href="/contact?category=sponsor"
            className="inline-flex items-center justify-center rounded-2xl bg-nicchyo-ink px-8 py-3.5 text-[14.5px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(58,58,58,0.55)] transition hover:bg-nicchyo-ink/90 active:scale-[0.99]"
          >
            ご支援のご相談
          </Link>
        </div>
      </div>

      <NavigationBar />
    </main>
  );
}
