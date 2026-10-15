import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award } from "lucide-react";
import { PageContainer } from "@/components/ui";
import { ABOUT, PHOTOS } from "./content";
import GrandmaFigure from "./GrandmaFigure";
import SectionHeading from "./SectionHeading";

/**
 * nicchyo について。誰がつくっているかと、開発チームのひとことを、現地で活動する写真と一緒に短く伝える。
 * 受賞などの事実は活動記録（app/data/activities.ts）に載っているものだけを書く
 */
export default function LandingAbout() {
  return (
    <section aria-labelledby="landing-about" className="mt-20">
      <PageContainer width="wide" className="grid gap-7 md:grid-cols-2 md:items-center md:gap-12">
        <Image
          src={PHOTOS.survey.src}
          alt={PHOTOS.survey.alt}
          width={PHOTOS.survey.width}
          height={PHOTOS.survey.height}
          sizes="(min-width: 768px) 30rem, 100vw"
          className="aspect-[4/3] w-full rounded-card object-cover"
        />
        <div>
          <SectionHeading id="landing-about" label="ABOUT">
            高知高専生が
            <br />
            つくっています
          </SectionHeading>
          <p className="mt-3 text-[15px] leading-relaxed text-nicchyo-ink/70">{ABOUT.body}</p>
          <p className="mt-3 flex items-start gap-2 border-l-[3px] border-nicchyo-primary pl-2.5 text-sm font-bold text-nicchyo-ink">
            <Award aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            {ABOUT.award}
          </p>
          <figure className="mt-6 flex items-end gap-3">
            <div className="flex-1">
              <blockquote className="font-display text-xl leading-relaxed text-nicchyo-ink">
                {ABOUT.message.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </blockquote>
              <figcaption className="mt-1 text-xs font-bold text-nicchyo-ink/55">{ABOUT.signature}</figcaption>
            </div>
            <GrandmaFigure className="h-[5.5rem] w-[5.5rem]" />
          </figure>
          <Link
            href="/activities"
            className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:text-amber-600"
          >
            これまでの取り組み
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      </PageContainer>
    </section>
  );
}
