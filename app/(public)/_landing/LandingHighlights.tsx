import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageContainer } from "@/components/ui";
import { HIGHLIGHTS, MARKET_FACTS } from "./content";
import type { LandingShopPhoto } from "./pickLandingShops";
import RevealOnScroll from "./RevealOnScroll";
import SectionHeading from "./SectionHeading";

/**
 * 日曜市のいいところ。写真が主役。文字は箱に入れず写真の下の方に重ね、
 * 写真が画面の中央あたりまで来たところで出す（写真の下側だけ暗くして読めるようにする。
 * 店のバナー ShopBannerHero と同じ幕）。
 *
 * その下に、出店者が登録した本物の店の写真を細長く並べる（3枚に満たなければ出さない）
 */
export default function LandingHighlights({ shopPhotos }: { shopPhotos: LandingShopPhoto[] }) {
  return (
    <section aria-labelledby="landing-highlights" className="mt-24">
      <PageContainer width="wide">
        <SectionHeading id="landing-highlights" label="HIGHLIGHTS">
          日曜市のいいところ
        </SectionHeading>
      </PageContainer>

      <PageContainer width="wide" className="mt-10 space-y-3 px-0 sm:space-y-6 sm:px-6">
        {HIGHLIGHTS.map((item) => (
          <article key={item.label} className="relative overflow-hidden sm:rounded-card">
            <Image
              src={item.photo.src}
              alt={item.photo.alt}
              width={item.photo.width}
              height={item.photo.height}
              sizes="(min-width: 1024px) 64rem, 100vw"
              className="aspect-[4/5] w-full object-cover sm:aspect-[16/10] md:aspect-[16/9]"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
              <RevealOnScroll className="max-w-lg text-white">
                <p className="text-[0.7rem] font-bold tracking-[0.3em] text-white/80">{item.label}</p>
                <h3 className="mt-2 font-display text-2xl leading-snug sm:text-3xl">{item.title}</h3>
                <p className="mt-3 text-sm leading-loose text-white/85 sm:text-base">{item.body}</p>
              </RevealOnScroll>
            </div>
          </article>
        ))}
      </PageContainer>

      {shopPhotos.length >= 3 && (
        <div className="mt-16">
          <PageContainer width="wide">
            <p className="text-sm font-bold text-nicchyo-ink">出店しているお店から</p>
          </PageContainer>
          {/* 細長い写真を横に並べる。はみ出した分は横に送る */}
          <ul className="mt-4 flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 pb-2 md:mx-auto md:max-w-[64rem] md:px-6">
            {shopPhotos.map((shop) => (
              <li key={shop.id} className="w-36 shrink-0 snap-start sm:w-44">
                <Link
                  href={`/shops/${shop.code}`}
                  className="group relative block aspect-[9/16] overflow-hidden rounded-card bg-nicchyo-ink/10"
                >
                  <Image
                    src={shop.image}
                    alt=""
                    fill
                    sizes="11rem"
                    className="object-cover transition-transform duration-500 ease-out-soft group-hover:scale-105 motion-reduce:transition-none"
                  />
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                  <span className="absolute bottom-3 right-3 text-sm font-bold tracking-[0.15em] text-white [writing-mode:vertical-rl]">
                    {shop.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 開催の案内。箱に入れず、罫で区切るだけにする */}
      <PageContainer width="wide" className="mt-14">
        <dl className="divide-y divide-line-warm border-y border-line-warm">
          {MARKET_FACTS.map((fact) => (
            <div key={fact.term} className="flex gap-4 py-4">
              <dt className="w-16 shrink-0 border-l-[3px] border-nicchyo-primary pl-2 text-sm font-bold text-nicchyo-ink">
                {fact.term}
              </dt>
              <dd className="text-sm leading-relaxed text-nicchyo-ink/70">{fact.detail}</dd>
            </div>
          ))}
        </dl>
        <Link
          href="/calendar"
          className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:text-amber-600"
        >
          開催カレンダーで、今週の開催を確かめる
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </PageContainer>
    </section>
  );
}
