import Image from "next/image";
import Link from "next/link";
import { PageContainer } from "@/components/ui";
import { HIGHLIGHTS } from "./content";
import type { LandingShopPhoto } from "./pickLandingShops";
import PhotoScrim from "./PhotoScrim";
import RevealOnScroll from "./RevealOnScroll";
import SectionHeading from "./SectionHeading";

/**
 * 日曜市のいいところ。写真が主役で、文字は写真に重ねる短い見出しだけ。
 * 見出しは写真が画面の中央あたりに来たところで出す（写真の下側だけ暗くして読めるようにする。
 * 店のバナー ShopBannerHero と同じ幕）。
 *
 * その下に、出店者が登録した本物の店の写真を細長く並べる（3枚に満たなければ出さない）
 */
export default function LandingHighlights({ shopPhotos }: { shopPhotos: LandingShopPhoto[] }) {
  return (
    <section aria-labelledby="landing-highlights" className="mt-20">
      <PageContainer width="wide">
        <SectionHeading id="landing-highlights" label="HIGHLIGHTS">
          日曜市のいいところ
        </SectionHeading>
        <ul className="mt-5 grid gap-3 md:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <li key={item.label} className="relative overflow-hidden rounded-card">
              <Image
                src={item.photo.src}
                alt={item.photo.alt}
                width={item.photo.width}
                height={item.photo.height}
                sizes="(min-width: 768px) 21rem, 100vw"
                className="aspect-[4/3] w-full object-cover md:aspect-[3/4]"
              />
              <PhotoScrim />
              <RevealOnScroll className="absolute inset-x-0 bottom-0 p-5 text-white">
                <p className="text-[0.65rem] font-bold tracking-[0.3em] text-white/80">{item.label}</p>
                <h3 className="mt-1 font-display text-xl leading-snug">{item.title}</h3>
              </RevealOnScroll>
            </li>
          ))}
        </ul>
      </PageContainer>

      {shopPhotos.length >= 3 && (
        <>
          {/* 出店者が登録した店の写真。細長く横に並べ、はみ出した分は横に送る */}
          <ul
            aria-label="出店しているお店から"
            className="mt-3 flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 pb-2 md:mx-auto md:max-w-[64rem] md:px-6"
          >
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
                  <PhotoScrim />
                  <span className="absolute bottom-3 right-3 text-sm font-bold tracking-[0.15em] text-white [writing-mode:vertical-rl]">
                    {shop.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
