import Image from "next/image";
import Link from "next/link";
import { PageContainer } from "@/components/ui";
import { ABOUT, PHOTOS } from "./content";
import SectionHeading from "./SectionHeading";

/**
 * 高知高専生がつくっています。現地で活動する写真・受賞・開発チームのひとことを、白い面に落ち着いて置く。
 * 受賞などの事実は活動記録（app/data/activities.ts）に載っているものだけを書く
 */
export default function LandingAbout() {
  return (
    <section aria-labelledby="landing-about" className="mt-20 md:mt-28">
      <PageContainer width="wide">
        <div className="grid gap-8 overflow-hidden rounded-sheet bg-white p-5 shadow-card ring-1 ring-line md:grid-cols-2 md:items-center md:gap-12 md:p-8">
          <Image
            src={PHOTOS.survey.src}
            alt={PHOTOS.survey.alt}
            width={PHOTOS.survey.width}
            height={PHOTOS.survey.height}
            sizes="(min-width: 768px) 30rem, 100vw"
            className="aspect-[4/3] w-full rounded-card object-cover"
          />
          <div>
            <SectionHeading id="landing-about">
              高知高専生が
              <br />
              つくっています
            </SectionHeading>
            <p className="mt-4 text-[15px] leading-loose text-nicchyo-ink/80">{ABOUT.body}</p>

            {/* 受賞 */}
            <p className="mt-5 border-l-[3px] border-nicchyo-primary pl-4 text-left">
              <span className="block text-xs font-bold text-nicchyo-ink/55">{ABOUT.awardName}</span>
              <span className="block text-lg font-black leading-snug text-nicchyo-ink">{ABOUT.awardTitle} 受賞</span>
            </p>

            {/* 開発チームのひとこと */}
            <figure className="mt-5">
              <blockquote className="text-lg font-bold leading-relaxed text-nicchyo-ink">
                {ABOUT.message.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </blockquote>
              <figcaption className="mt-1 text-xs font-bold text-nicchyo-ink/55">{ABOUT.signature}</figcaption>
            </figure>

            <Link
              href="/activities"
              className="mt-5 inline-flex h-11 items-center rounded-chip border border-amber-200 bg-white px-5 text-sm font-bold text-amber-800 shadow-chip transition hover:bg-amber-50 motion-reduce:transition-none"
            >
              これまでの取り組み →
            </Link>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
