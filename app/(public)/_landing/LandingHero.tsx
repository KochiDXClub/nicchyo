import Link from "next/link";
import { getImageProps } from "next/image";
import { MapPin } from "lucide-react";
import { buttonClass } from "@/components/ui";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { MarketDay } from "@/lib/market/calendar";
import MarketStatusBar from "../../components/market/MarketStatusBar";
import { PHOTOS } from "./content";
import PhotoScrim from "./PhotoScrim";
import RevealOnScroll from "./RevealOnScroll";

/**
 * 最初の一画面。写真を地にして、上から「ヘッダー（nicchyo・言語）→ 見出し → マップをみる → 今週の開催予定 → 検索」の順に並べる。
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
      aria-labelledby="landing-title"
      className="relative flex min-h-[100svh] flex-col overflow-hidden bg-nicchyo-ink md:min-h-[44rem]"
    >
      <picture>
        <source media="(min-width: 768px)" srcSet={wideSrcSet} />
        <source srcSet={tallSrcSet} />
        {/* getImageProps で最適化済みの <img>（art direction のため next/image ではなく <picture> で組む） */}
        <img {...imgProps} alt={common.alt} className="absolute inset-0 h-full w-full object-cover" />
      </picture>
      {/* 文字を載せる上側と、検索を載せる下側を暗くする */}
      <PhotoScrim withTop />
      <div aria-hidden className="absolute inset-0 bg-black/20 md:bg-black/30" />

      {/* ヘッダー：左にサイト名、右に言語 */}
      <header className="relative z-20 px-5 pt-[var(--safe-top,0px)] md:px-10">
        <div className="mx-auto flex h-14 max-w-[64rem] items-center justify-between md:h-16">
          <Link href="/" className="text-xl font-black tracking-wide text-white">
            nicchyo
          </Link>
          <LanguageSwitcher tone="photo" className="-mr-3" />
        </div>
        <div aria-hidden className="mx-auto h-px max-w-[64rem] bg-white/25" />
      </header>

      <div className="relative z-10 flex-1 px-5 pb-[calc(6rem+var(--safe-bottom,0px))] pt-10 md:px-10 md:pb-16 md:pt-16">
        <div className="mx-auto max-w-[64rem]">
          <RevealOnScroll when="enter" className="max-w-[28rem] md:max-w-[34rem]">
            <h1 id="landing-title" className="text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
              <span className="block text-sm font-bold tracking-wide text-white/90">高知高専生が開発した</span>
              <span className="mt-2 block text-[2.5rem] font-black leading-[1.2] tracking-wide sm:text-5xl md:text-6xl">
                日曜市の
                <br />
                デジタルマップ
              </span>
            </h1>

            {/* いちばんしてほしいこと：地図をひらく */}
            <Link href="/map" className={buttonClass({ size: "lg", className: "mt-7 h-14 w-full text-lg shadow-float" })}>
              <MapPin aria-hidden className="h-5 w-5" />
              マップをみる
            </Link>

            {/* 今週の開催予定 */}
            <div className="mt-6">
              <p className="mb-2 text-xs font-bold tracking-wide text-white/85">今週の開催予定</p>
              <MarketStatusBar day={day} placement="page" className="w-full" />
            </div>

            {/* お店さがし。地図をひらき、検索バーにこの語を入れて絞り込む（/map?q=） */}
            <form
              action="/map"
              method="get"
              role="search"
              className="mt-6 flex min-w-0 items-center gap-1.5 rounded-chip bg-white py-1.5 pl-5 pr-1.5 shadow-float"
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
    </section>
  );
}
