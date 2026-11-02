import Image from "next/image";
import Link from "next/link";
import { PageContainer } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { HIGHLIGHTS } from "./content";
import HandNote from "./HandNote";
import InView from "./InView";
import type { LandingShopPhoto } from "./pickLandingShops";
import PhotoScrim from "./PhotoScrim";
import SectionHeading from "./SectionHeading";

/**
 * 日曜市って、こんなところ！ 写真をポラロイドのように貼り、写真の上に手描きの一言が書かれる。
 * 写真の下側だけ暗くして読めるようにする（店のバナー ShopBannerHero と同じ幕）。
 *
 * その下に、出店者が登録した本物の店の写真を細長く並べる（3枚に満たなければ出さない）
 */
export default function LandingHighlights({ shopPhotos }: { shopPhotos: LandingShopPhoto[] }) {
  return (
    <section aria-labelledby="landing-highlights" className="mt-20 md:mt-28">
      <PageContainer width="wide">
        <SectionHeading id="landing-highlights">日曜市って、こんなところ！</SectionHeading>
        <InView once>
          <ul className="mt-8 grid gap-6 md:grid-cols-3 md:gap-5">
            {HIGHLIGHTS.map((item, index) => (
              <li
                key={item.id}
                className={cn(
                  "relative rounded-md bg-white p-2 shadow-lift ring-1 ring-line-warm transition-transform duration-300 hover:rotate-0 hover:-translate-y-2 motion-reduce:transition-none",
                  index === 0 && "md:-rotate-[1.6deg]",
                  index === 1 && "md:mt-4 md:rotate-[1.2deg]",
                  index === 2 && "md:-rotate-[0.8deg]"
                )}
              >
                {/* マスキングテープ */}
                <span aria-hidden className="absolute -top-3 left-1/2 z-[2] h-6 w-[5.4rem] -translate-x-1/2 -rotate-3 bg-nicchyo-accent/80 shadow-chip" />
                <div className="relative overflow-hidden rounded-sm">
                  <Image
                    src={item.photo.src}
                    alt={item.photo.alt}
                    width={item.photo.width}
                    height={item.photo.height}
                    sizes="(min-width: 768px) 21rem, 100vw"
                    className="aspect-[4/3] w-full object-cover md:aspect-[3/4]"
                  />
                  <PhotoScrim />
                  <HandNote size={27} delay={item.delay} className="bottom-5 left-5 -rotate-3">
                    {item.title}
                  </HandNote>
                </div>
                {/* 写真のはしに貼るシール */}
                {/* eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG（最適化の対象外） */}
                <img src={item.sticker} alt="" width={56} height={56} className="absolute -right-3.5 -top-5 z-[3] h-14 w-14 rotate-12 drop-shadow-md" />
              </li>
            ))}
          </ul>
        </InView>
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
