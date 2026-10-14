import Image from "next/image";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { PageContainer, Surface, buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { HIGHLIGHTS, MARKET_FACTS } from "./content";
import type { LandingShopPhoto } from "./pickLandingShops";
import GrandmaPerch from "./GrandmaPerch";
import SectionHeading from "./SectionHeading";

/**
 * 日曜市の良いところ。写真が主役で、白い面の短い文を写真の端に重ねる。
 * 広い画面では写真の左右を交互にする。
 *
 * その下に、出店者が登録した本物の店の写真を細長く並べる（3枚に満たなければ出さない）
 */
export default function LandingHighlights({ shopPhotos }: { shopPhotos: LandingShopPhoto[] }) {
  return (
    <section aria-labelledby="landing-highlights" data-grandma-section="highlights" className="mt-24">
      <PageContainer width="wide">
        <SectionHeading id="landing-highlights" label="HIGHLIGHTS">
          日曜市のいいところ
        </SectionHeading>
      </PageContainer>

      <div className="mt-10 space-y-14 md:space-y-20">
        {HIGHLIGHTS.map((item, index) => {
          const reverse = index % 2 === 1;
          return (
            <PageContainer key={item.label} width="wide" className="px-0 sm:px-6">
              <article className={cn("relative md:flex md:items-center", reverse && "md:flex-row-reverse")}>
                <Image
                  src={item.photo.src}
                  alt={item.photo.alt}
                  width={item.photo.width}
                  height={item.photo.height}
                  sizes="(min-width: 768px) 40rem, 100vw"
                  className="aspect-[4/3] w-full object-cover sm:rounded-card md:w-[64%] md:shadow-card"
                />
                <Surface
                  padding="lg"
                  className={cn(
                    "relative mx-5 -mt-12 sm:mx-8 md:mx-0 md:mt-0 md:w-[42%] md:shrink-0",
                    reverse ? "md:-mr-[6%]" : "md:-ml-[6%]"
                  )}
                >
                  {index === 0 && <GrandmaPerch section="highlights" className="absolute -top-[5.5rem] right-4" />}
                  <p className="text-[0.7rem] font-bold tracking-[0.3em] text-amber-700">{item.label}</p>
                  <h3 className="mt-2 font-display text-xl leading-snug text-nicchyo-ink">{item.title}</h3>
                  <p className="mt-3 text-sm leading-loose text-nicchyo-ink/70">{item.body}</p>
                </Surface>
              </article>
            </PageContainer>
          );
        })}
      </div>

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
                  {/* 名前は写真に重ねず、白い面に縦書きで載せる */}
                  <span className="absolute bottom-2 right-2 bg-white px-1.5 py-2 text-xs font-bold tracking-[0.15em] text-nicchyo-ink shadow-card [writing-mode:vertical-rl]">
                    {shop.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PageContainer width="wide" className="mt-14">
        <Surface elevation="flat" padding="lg" className="md:flex md:items-center md:gap-10">
          <dl className="flex-1 divide-y divide-line">
            {MARKET_FACTS.map((fact) => (
              <div key={fact.term} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                <dt className="w-16 shrink-0 border-l-[3px] border-nicchyo-primary pl-2 text-sm font-bold text-nicchyo-ink">
                  {fact.term}
                </dt>
                <dd className="text-sm leading-relaxed text-nicchyo-ink/70">{fact.detail}</dd>
              </div>
            ))}
          </dl>
          <Link href="/calendar" className={buttonClass({ variant: "quiet", className: "mt-5 w-full md:mt-0 md:w-auto" })}>
            <CalendarDays aria-hidden className="h-4 w-4" />
            開催カレンダー
          </Link>
        </Surface>
      </PageContainer>
    </section>
  );
}
