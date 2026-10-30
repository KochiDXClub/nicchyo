import Link from "next/link";
import Image, { getImageProps } from "next/image";
import { MapPin } from "lucide-react";
import { buttonClass } from "@/components/ui";
import LanguageSwitcher from "@/components/navigation/LanguageSwitcher";
import type { MarketDay } from "@/lib/market/calendar";
import MarketStatusBar from "../../components/market/MarketStatusBar";
import { PHOTOS } from "./content";
import { PHOTO_TEXT_SHADOW } from "@/lib/ui/photoText";
// 使い方・開催のご案内など、下のセクションの見た目もこのCSSに頼っている（消さない）
import "./landing.css";
import MapFab from "./MapFab";
import RevealOnScroll from "./RevealOnScroll";

/**
 * 最初の一画面。写真を地にして、上から「ヘッダー（nicchyoのロゴ・言語）→ 見出し →（下に）マップをみる → 今週の開催日 → 検索」の順に並べる。
 * 「マップをみる」は、この画面では大きなボタン。画面を過ぎてスクロールすると、右下の丸いボタン（MapFab）が出る。
 * 飾り（旗・判子・キャラクター・柑橘・葉）は置かない。写真と白い文字だけで、落ち着いた入口にする。
 *
 * 内容は上から積む（下端には貼りつけない）。ブラウザの下のツールバーが重なっても、検索が隠れない。
 * 写真は画面の向きで出し分ける。スマートフォンは縦長の「上から見た通り」、
 * 広い画面は横長の「屋台の通り」。<picture> で、見ない方の写真は読み込まない
 */
export default function LandingHero({ day }: { day: MarketDay | null }) {
  const common = { alt: "屋台のテントが並ぶ、日曜市の通り", sizes: "100vw", priority: true } as const;
  const {
    props: { srcSet: wideSrcSet },
  } = getImageProps({ ...common, src: PHOTOS.stalls.src, width: PHOTOS.stalls.width, height: PHOTOS.stalls.height });
  const {
    props: { srcSet: tallSrcSet, ...imgProps },
  } = getImageProps({ ...common, src: PHOTOS.overview.src, width: PHOTOS.overview.width, height: PHOTOS.overview.height });

  return (
    <section
      id="landing-hero"
      aria-labelledby="landing-title"
      className="relative flex min-h-[100svh] flex-col overflow-hidden bg-nicchyo-ink md:min-h-[max(40rem,100svh)]"
    >
      <picture>
        <source media="(min-width: 768px)" srcSet={wideSrcSet} />
        <source srcSet={tallSrcSet} />
        {/* getImageProps で最適化済みの <img>（art direction のため next/image ではなく <picture> で組む） */}
        <img {...imgProps} alt={common.alt} className="absolute inset-0 h-full w-full object-cover brightness-105" />
      </picture>
      {/* 白い文字が読めるよう、見出しのある上側だけ、ほんの少し暗くする（写真の下側は元の明るさのまま） */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[22rem] bg-gradient-to-b from-black/45 via-black/20 to-transparent md:h-[26rem]" />

      {/* ヘッダー：メニューのヘッダーと同じ背景色。左にロゴ、右に言語 */}
      <header className="relative z-20 border-b border-line-warm bg-nicchyo-base px-5 pt-[var(--safe-top,0px)] shadow-chip md:px-10">
        <div className="mx-auto flex h-14 max-w-[64rem] items-center justify-between md:h-16">
          <Link href="/" aria-label="nicchyo">
            <Image
              src="/images/nicchyo-logo.webp"
              alt="nicchyo"
              width={516}
              height={240}
              priority
              className="h-11 w-auto md:h-12"
            />
          </Link>
          <LanguageSwitcher tone="page" />
        </div>
      </header>

      {/* 見出しは上、開催予定と検索は下（親指の届く側）に分けて置く。間は写真を見せる */}
      <div className="relative z-10 flex flex-1 flex-col px-5 pb-[calc(7rem+var(--safe-bottom,0px))] pt-10 md:px-10 md:pb-12 md:pt-12">
        <div className="mx-auto flex w-full max-w-[64rem] flex-1 flex-col justify-between gap-10">
          <RevealOnScroll when="enter" className="max-w-[28rem] md:max-w-[34rem]">
            <h1 id="landing-title" className={`text-white ${PHOTO_TEXT_SHADOW}`}>
              <span className="sr-only">nicchyo：</span>
              <span className="block text-sm font-bold tracking-wide text-white">高知高専生が開発した</span>
              <span className="mt-2 block text-[2.5rem] font-black leading-[1.2] tracking-wide sm:text-5xl md:text-6xl">
                日曜市の
                <br />
                デジタルマップ
              </span>
            </h1>
          </RevealOnScroll>

          <RevealOnScroll when="enter" delayMs={150} className="max-w-[28rem] md:max-w-[34rem]">
            {/* いちばんしてほしいこと：地図をひらく（この画面を過ぎると、右下の丸いボタンに替わる） */}
            <Link href="/map" className={buttonClass({ size: "lg", className: "h-14 w-full text-lg shadow-float" })}>
              <MapPin aria-hidden className="h-5 w-5" />
              マップをみる
            </Link>

            {/* 今週の開催日（見出しの文言は置かない。日付と「開催」で伝わる） */}
            <div className="mt-5">
              <MarketStatusBar day={day} placement="page" className="w-full" />
            </div>

            {/* お店さがし。地図をひらき、検索バーにこの語を入れて絞り込む（/map?q=） */}
            <form
              action="/map"
              method="get"
              role="search"
              className="mt-4 flex min-w-0 items-center gap-1.5 rounded-chip bg-white py-1.5 pl-5 pr-1.5 shadow-float"
            >
              <label htmlFor="landing-search" className="sr-only">
                お店や品物をさがす
              </label>
              <input
                id="landing-search"
                name="q"
                type="search"
                enterKeyHint="search"
                placeholder="なにを探す？　例：芋天"
                className="h-10 min-w-0 flex-1 bg-transparent text-base text-nicchyo-ink outline-none placeholder:text-nicchyo-ink/40"
              />
              <button type="submit" className={buttonClass({ variant: "ink", size: "sm", className: "h-10" })}>
                さがす
              </button>
            </form>
          </RevealOnScroll>
        </div>
      </div>

      <MapFab afterId="landing-hero" />
    </section>
  );
}
