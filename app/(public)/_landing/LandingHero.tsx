import Link from "next/link";
import { getImageProps } from "next/image";
import { MapPin, MessageCircle } from "lucide-react";
import { Surface, buttonClass } from "@/components/ui";
import { siteTextWithEmphasis } from "@/lib/siteCopy";
import { PHOTOS } from "./content";

/**
 * 最初の一画面。写真を画面いっぱいに置き、文字は写真に重ねず白い面に載せる
 * （写真の上の文字は、写真によって読めなくなるうえ、暗くする幕が要る）。
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
    <section aria-labelledby="landing-title" className="relative">
      <div className="relative h-[calc(100svh-7rem)] min-h-[28rem] overflow-hidden bg-nicchyo-ink/10 md:h-[min(100svh,54rem)]">
        <picture>
          <source media="(min-width: 768px)" srcSet={wideSrcSet} />
          <source srcSet={tallSrcSet} />
          {/* getImageProps で最適化済みの <img>（art direction のため next/image ではなく <picture> で組む） */}
          <img {...imgProps} alt={common.alt} className="h-full w-full object-cover" />
        </picture>

        {/* 看板。写真の上でも読めるよう白い面にして、縦書きで置く */}
        <div className="absolute left-4 top-[calc(1rem+var(--safe-top,0px))] flex w-16 flex-col items-center gap-3 bg-white px-2 py-4 shadow-card md:left-10 md:w-20">
          {/* eslint-disable-next-line @next/next/no-img-element -- 64px の SVG。最適化の対象外 */}
          <img src="/icon.svg" alt="" width={40} height={40} className="h-10 w-10 rounded-btn" />
          <p className="font-display text-3xl tracking-[0.15em] text-nicchyo-ink [writing-mode:vertical-rl] md:text-4xl">
            日曜市
          </p>
          <p className="text-xs font-bold tracking-[0.1em] text-nicchyo-ink/70 [writing-mode:vertical-rl]">
            高知・追手筋
          </p>
        </div>
      </div>

      <div className="relative z-[1] mx-4 -mt-24 md:absolute md:bottom-10 md:right-10 md:mx-0 md:mt-0 md:w-[26rem]">
        <Surface elevation="lifted" padding="lg">
          <h1 id="landing-title" className="text-nicchyo-ink">
            <span className="block text-sm font-bold tracking-wide text-amber-700">高知高専生が開発した</span>
            <span className="mt-1 block font-display text-2xl leading-snug sm:text-[1.75rem]">日曜市のデジタルマップ</span>
            <span className="mt-1 block text-4xl font-black tracking-wide">nicchyo</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-nicchyo-ink/70">
            {siteTextWithEmphasis("mapIntro.lead", "font-bold text-nicchyo-ink")}
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <Link href="/map" className={buttonClass({ size: "lg" })}>
              <MapPin aria-hidden className="h-5 w-5" />
              マップをひらく
            </Link>
            <Link href="/consult" className={buttonClass({ variant: "secondary", size: "lg" })}>
              <MessageCircle aria-hidden className="h-5 w-5" />
              にちよさんに聞く
            </Link>
          </div>
        </Surface>
      </div>
    </section>
  );
}
