import Link from "next/link";
import { getImageProps } from "next/image";
import { MapPin, MessageCircle } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { siteTextWithEmphasis } from "@/lib/siteCopy";
import { PHOTOS } from "./content";
import RevealOnScroll from "./RevealOnScroll";

/**
 * 最初の一画面。写真を画面いっぱいに置き、名前と入口を写真の下の方に重ねる。
 * 文字が読めるよう、写真の下側だけを暗くする（店のバナー ShopBannerHero と同じ幕）。
 *
 * 写真は画面の向きで出し分ける。スマートフォンは縦長の「上から見た通り」、
 * 広い画面は横長の「屋台の通り」。<picture> で、見ない方の写真は読み込まない
 */
export default function LandingHero() {
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
     
      className="relative h-[100svh] min-h-[36rem] overflow-hidden bg-nicchyo-ink md:max-h-[56rem]"
    >
      <picture>
        <source media="(min-width: 768px)" srcSet={wideSrcSet} />
        <source srcSet={tallSrcSet} />
        {/* getImageProps で最適化済みの <img>（art direction のため next/image ではなく <picture> で組む） */}
        <img {...imgProps} alt={common.alt} className="absolute inset-0 h-full w-full object-cover" />
      </picture>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

      {/* 看板。縦書きで左上に置く */}
      <div className="absolute left-4 top-[calc(1rem+var(--safe-top,0px))] flex w-16 flex-col items-center gap-3 bg-white px-2 py-4 shadow-card md:left-10 md:w-20">
        {/* eslint-disable-next-line @next/next/no-img-element -- 64px の SVG。最適化の対象外 */}
        <img src="/icon.svg" alt="" width={40} height={40} className="h-10 w-10 rounded-btn" />
        <p className="font-display text-3xl tracking-[0.15em] text-nicchyo-ink [writing-mode:vertical-rl] md:text-4xl">
          日曜市
        </p>
        <p className="text-xs font-bold tracking-[0.1em] text-nicchyo-ink/70 [writing-mode:vertical-rl]">高知・追手筋</p>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-5 pb-[calc(2rem+var(--safe-bottom,0px))] md:px-10 md:pb-12">
        <div className="mx-auto max-w-[64rem]">
          <RevealOnScroll when="enter">
            <h1 id="landing-title" className="text-white">
              <span className="block text-sm font-bold tracking-wide text-white/85">高知高専生が開発した</span>
              <span className="mt-1 block font-display text-[1.75rem] leading-snug sm:text-4xl">日曜市のデジタルマップ</span>
              <span className="mt-1 block text-5xl font-black tracking-wide sm:text-6xl">nicchyo</span>
            </h1>
          </RevealOnScroll>
          <RevealOnScroll when="enter" delayMs={150}>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85 sm:text-base">
              {siteTextWithEmphasis("mapIntro.lead", "font-bold text-white")}
            </p>
          </RevealOnScroll>
          <RevealOnScroll when="enter" delayMs={300} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/map" className={buttonClass({ size: "lg" })}>
              <MapPin aria-hidden className="h-5 w-5" />
              マップをひらく
            </Link>
            <Link href="/consult" className={buttonClass({ variant: "secondary", size: "lg" })}>
              <MessageCircle aria-hidden className="h-5 w-5" />
              にちよさんに聞く
            </Link>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
