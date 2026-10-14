import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageContainer, Surface, buttonClass } from "@/components/ui";
import { MESSAGE, PHOTOS } from "./content";
import GrandmaPerch from "./GrandmaPerch";
import SectionHeading from "./SectionHeading";

/** メッセージ。開発チームのことばと、最後にもう一度だけ地図への入口を置く */
export default function LandingMessage() {
  return (
    <section aria-labelledby="landing-message" data-grandma-section="message" className="mt-24">
      <PageContainer width="wide">
        <SectionHeading id="landing-message" label="MESSAGE">
          メッセージ
        </SectionHeading>
      </PageContainer>

      <div className="relative mt-10">
        <Image
          src={PHOTOS.stalls.src}
          alt={PHOTOS.stalls.alt}
          width={PHOTOS.stalls.width}
          height={PHOTOS.stalls.height}
          sizes="100vw"
          className="h-72 w-full object-cover sm:h-96 md:h-[28rem]"
        />
        <PageContainer width="reading" className="relative -mt-20 sm:-mt-28">
          <Surface padding="lg" className="relative sm:px-10 sm:py-10">
            <GrandmaPerch section="message" className="absolute -top-[5.5rem] right-6" />
            <p className="font-display text-2xl leading-relaxed text-nicchyo-ink sm:text-[1.75rem]">
              {MESSAGE.title.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
            <div className="mt-5 space-y-4 text-base leading-loose text-nicchyo-ink/70">
              {MESSAGE.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <p className="mt-6 text-right text-sm font-bold text-nicchyo-ink">{MESSAGE.signature}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/map" className={buttonClass({ size: "lg" })}>
                <MapPin aria-hidden className="h-5 w-5" />
                マップをひらく
              </Link>
              <Link href="/about" className={buttonClass({ variant: "quiet", size: "lg" })}>
                nicchyo について
              </Link>
            </div>
          </Surface>
        </PageContainer>
      </div>
    </section>
  );
}
