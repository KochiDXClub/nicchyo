import Link from "next/link";
import { getImageProps } from "next/image";
import { MapPin } from "lucide-react";
import { buttonClass } from "@/components/ui";
import type { MarketDay } from "@/lib/market/calendar";
import MarketStatusBar from "../../components/market/MarketStatusBar";
import { PHOTOS } from "./content";
import type { IntroDemoShop } from "../map/components/intro/introDemoShops";
import LandingHeroMarkers from "./LandingHeroMarkers";
import PhotoScrim from "./PhotoScrim";
import RevealOnScroll from "./RevealOnScroll";

/**
 * 最初の一画面。写真を画面いっぱいに置き、その上に「今週の開催」「名前」「さがす」「地図」だけを載せる。
 * 現地にいる人がすぐ使えるよう、説明文は置かない（日曜市の説明は下の開催のご案内にある）。
 * 文字が読めるよう、写真の下側だけを暗くする（店のバナー ShopBannerHero と同じ幕）。
 *
 * 写真は画面の向きで出し分ける。スマートフォンは縦長の「上から見た通り」、
 * 広い画面は横長の「屋台の通り」。<picture> で、見ない方の写真は読み込まない
 */
export default function LandingHero({ day, shops }: { day: MarketDay | null; shops: IntroDemoShop[] }) {
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
      className="relative h-[100svh] min-h-[36rem] overflow-hidden bg-nicchyo-ink md:max-h-[48rem]"
    >
      <picture>
        <source media="(min-width: 768px)" srcSet={wideSrcSet} />
        <source srcSet={tallSrcSet} />
        {/* getImageProps で最適化済みの <img>（art direction のため next/image ではなく <picture> で組む） */}
        <img {...imgProps} alt={common.alt} className="absolute inset-0 h-full w-full object-cover" />
      </picture>
      <PhotoScrim withTop />
      <LandingHeroMarkers shops={shops} />

      {/* ロゴ */}
      <div className="pointer-events-none absolute left-4 top-[calc(1rem+var(--safe-top,0px))] rounded-card bg-white p-1.5 shadow-card md:left-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- 64px の SVG。最適化の対象外 */}
        <img src="/icon.svg" alt="" width={40} height={40} className="h-10 w-10 rounded-btn" />
      </div>

      {/* 上：今週の開催と名前。写真の下の方（マーカー）をふさがないよう上にまとめる */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(5.5rem+var(--safe-top,0px))] px-5 md:px-10">
        <div className="mx-auto max-w-[64rem]">
          <RevealOnScroll when="enter">
            <MarketStatusBar day={day} placement="page" className="pointer-events-auto w-fit max-w-full" />
            <h1 id="landing-title" className="mt-3 text-white">
              <span className="block text-xs font-bold tracking-wide text-white/90">高知高専生が開発した</span>
              <span className="mt-1.5 block font-display text-xl leading-snug sm:text-2xl">
                <span className="landing-hl">日曜市のデジタルマップ</span>
              </span>
              <span className="mt-1 block text-5xl font-black tracking-wide sm:text-6xl">
                <span className="landing-hl landing-hl-delay">nicchyo</span>
              </span>
            </h1>
          </RevealOnScroll>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-5 pb-[calc(2rem+var(--safe-bottom,0px))] md:px-10 md:pb-12">
        <div className="mx-auto max-w-[64rem]">
          <RevealOnScroll when="enter" delayMs={150} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* お店さがし。地図をひらき、検索バーにこの語を入れて絞り込む（/map?q=） */}
            <form
              action="/map"
              method="get"
              role="search"
              className="flex min-w-0 items-center gap-1.5 rounded-chip bg-white py-1.5 pl-5 pr-1.5 shadow-card sm:w-[26rem]"
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
                className="h-9 min-w-0 flex-1 bg-transparent text-base text-nicchyo-ink outline-none placeholder:text-nicchyo-ink/40"
              />
              <button type="submit" className={buttonClass({ variant: "ink", size: "sm", className: "h-10" })}>
                さがす
              </button>
            </form>
            <Link href="/map" className={buttonClass({ size: "lg" })}>
              <MapPin aria-hidden className="h-5 w-5" />
              マップをひらく
            </Link>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
