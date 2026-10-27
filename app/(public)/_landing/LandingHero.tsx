import Link from "next/link";
import { getImageProps } from "next/image";
import { MapPin } from "lucide-react";
import { buttonClass } from "@/components/ui";
import type { MarketDay } from "@/lib/market/calendar";
import MarketStatusBar from "../../components/market/MarketStatusBar";
import { PHOTOS } from "./content";
import "./landing.css";
import HandNote from "./HandNote";
import InView from "./InView";
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
/** 最初の写真に漂わせる飾り。位置は写真に対する割合（スマホでは小さいものだけ出す） */
const HERO_FLOATERS = [
  { id: "c1", src: "/images/landing/art/citrus.svg", className: "left-[62%] top-[44%]", size: 44, delay: 0 },
  { id: "c2", src: "/images/landing/art/citrus.svg", className: "left-[82%] top-[58%] hidden md:block", size: 30, delay: -2 },
  { id: "c3", src: "/images/landing/art/citrus.svg", className: "left-[70%] top-[22%] hidden md:block", size: 24, delay: -4 },
  { id: "l1", src: "/images/landing/art/leaf-green.svg", className: "left-[54%] top-[30%]", size: 26, delay: -1 },
  { id: "l2", src: "/images/landing/art/leaf-mint.svg", className: "left-[90%] top-[38%] hidden md:block", size: 20, delay: -3 },
  { id: "l3", src: "/images/landing/art/leaf-yellow.svg", className: "left-[8%] top-[66%]", size: 22, delay: -5 },
] as const;

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
      className="relative h-[100svh] min-h-[36rem] overflow-hidden bg-nicchyo-ink md:max-h-[48rem]"
    >
      <picture>
        <source media="(min-width: 768px)" srcSet={wideSrcSet} />
        <source srcSet={tallSrcSet} />
        {/* getImageProps で最適化済みの <img>（art direction のため next/image ではなく <picture> で組む） */}
        <img {...imgProps} alt={common.alt} className="absolute inset-0 h-full w-full object-cover" />
      </picture>
      <PhotoScrim withTop />

      {/* 旗の飾り（風でゆれる）と、回る判子。写真の上の飾りで、読み上げない */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG（最適化の対象外） */}
      <img src="/images/landing/art/bunting.svg" alt="" width={1440} height={96} className="landing-sway pointer-events-none absolute left-0 top-0 h-[92px] w-full max-w-none object-cover object-top drop-shadow-md" />
      <div
        aria-hidden
        className="landing-pop pointer-events-none absolute right-3.5 top-16 h-[92px] w-[92px] rotate-[8deg] drop-shadow-lg md:right-14 md:top-[60px] md:h-[150px] md:w-[150px]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG */}
        <img src="/images/landing/art/seal-ring.svg" alt="" width={160} height={160} className="landing-spin absolute inset-0 h-full w-full" />
        {/* eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG */}
        <img src="/images/landing/art/seal-core.svg" alt="" width={160} height={160} className="absolute inset-0 h-full w-full" />
      </div>
      {/* ふわふわ漂う柑橘と葉。写真をじゃましない小さな飾り */}
      {HERO_FLOATERS.map((item) => (
        // eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG
        <img key={item.id} src={item.src} alt="" width={40} height={40} className={`landing-float pointer-events-none absolute drop-shadow-md ${item.className}`} style={{ ["--d" as string]: `${item.delay}s`, width: item.size }} />
      ))}

      {/* 上：今週の開催と名前 */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(7rem+var(--safe-top,0px))] md:top-[calc(7.75rem+var(--safe-top,0px))] px-5 md:px-10">
        <div className="mx-auto max-w-[64rem]">
          <RevealOnScroll when="enter">
            <MarketStatusBar day={day} placement="page" className="pointer-events-auto w-fit max-w-full" />
            <h1 id="landing-title" className="mt-3 text-white">
              <span className="block text-xs font-bold leading-loose tracking-wide"><span className="landing-hl">高知高専生が開発した</span></span>
              <span className="mt-1.5 block font-display text-xl leading-snug sm:text-2xl">
                <span className="landing-hl">日曜市のデジタルマップ</span>
              </span>
              <span className="mt-1 block text-5xl font-black tracking-wide sm:text-6xl">
                <span className="landing-hl landing-hl-accent landing-hl-delay">nicchyo</span>
                {/* にちよさん。nicchyo の文字の右横に、シールのように置く */}
                {/* eslint-disable-next-line @next/next/no-img-element -- 既存の透過 WebP（80px） */}
                <img src="/images/obaasan_transparent.webp" alt="" width={96} height={96} className="landing-sticker landing-wave ml-1 inline-block h-[4.5rem] w-[4.5rem] align-bottom md:h-24 md:w-24" />
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
      {/* 写真の上に書かれる、ひとこと（広い画面だけ。スマホは文字が多くなるので出さない） */}
      <InView once className="pointer-events-none absolute inset-0 hidden md:block">
        <HandNote size={32} delay={1} className="right-[6%] top-[46%] -rotate-[5deg]" arrowClassName="-left-16 top-[62%] w-[70px] -rotate-[20deg] -scale-x-100">
          毎週日曜、
          <br />
          朝から夕方まで！
        </HandNote>
      </InView>
    </section>
  );
}
