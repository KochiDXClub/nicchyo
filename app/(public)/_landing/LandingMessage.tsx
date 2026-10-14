import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageContainer, buttonClass } from "@/components/ui";
import { MESSAGE, PHOTOS } from "./content";
import GrandmaFigure from "./GrandmaFigure";
import RevealOnScroll from "./RevealOnScroll";
import SectionHeading from "./SectionHeading";

/**
 * メッセージ。見出しは写真に重ねて、スクロールで出す。本文は箱に入れずに写真の下へ置き、
 * 最後にもう一度だけ地図への入口を置く
 */
export default function LandingMessage() {
  return (
    <section aria-labelledby="landing-message" className="mt-24">
      <PageContainer width="wide">
        <SectionHeading id="landing-message" label="MESSAGE">
          メッセージ
        </SectionHeading>
      </PageContainer>

      <div className="relative mt-10 overflow-hidden">
        <Image
          src={PHOTOS.stalls.src}
          alt={PHOTOS.stalls.alt}
          width={PHOTOS.stalls.width}
          height={PHOTOS.stalls.height}
          sizes="100vw"
          className="h-[28rem] w-full object-cover sm:h-[32rem]"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
        <PageContainer width="reading" className="absolute inset-x-0 bottom-0 pb-8 sm:pb-12">
          <RevealOnScroll>
            <p className="font-display text-3xl leading-relaxed text-white sm:text-4xl">
              {MESSAGE.title.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          </RevealOnScroll>
        </PageContainer>
      </div>

      <PageContainer width="reading" className="relative mt-10">
        <GrandmaFigure className="absolute -top-28 right-5 sm:right-6" />
        <RevealOnScroll className="space-y-4 text-base leading-loose text-nicchyo-ink/70">
          {MESSAGE.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p className="pt-2 text-right text-sm font-bold text-nicchyo-ink">{MESSAGE.signature}</p>
        </RevealOnScroll>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/map" className={buttonClass({ size: "lg" })}>
            <MapPin aria-hidden className="h-5 w-5" />
            マップをひらく
          </Link>
          <Link href="/about" className={buttonClass({ variant: "quiet", size: "lg" })}>
            nicchyo について
          </Link>
        </div>
      </PageContainer>
    </section>
  );
}
