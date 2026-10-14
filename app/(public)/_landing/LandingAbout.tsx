import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award } from "lucide-react";
import { PageContainer } from "@/components/ui";
import { PHOTOS } from "./content";
import GrandmaFigure from "./GrandmaFigure";
import SectionHeading from "./SectionHeading";

/**
 * nicchyo とは。誰が・何のためにつくっているかを、現地で活動する写真と一緒に伝える。
 * 受賞などの事実は活動記録（app/data/activities.ts）に載っているものだけを書く
 */
export default function LandingAbout() {
  return (
    <section aria-labelledby="landing-about" className="mt-24">
      <PageContainer width="wide">
        <SectionHeading id="landing-about" label="ABOUT">
          nicchyoとは
        </SectionHeading>

        <div className="mt-10 grid gap-8 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-12">
          <Image
            src={PHOTOS.survey.src}
            alt={PHOTOS.survey.alt}
            width={PHOTOS.survey.width}
            height={PHOTOS.survey.height}
            sizes="(min-width: 768px) 34rem, 100vw"
            className="-mx-5 aspect-[4/3] w-[calc(100%+2.5rem)] max-w-none object-cover sm:mx-0 sm:w-full sm:rounded-card sm:shadow-card"
          />
          <div className="relative">
            <GrandmaFigure className="absolute -top-20 right-0" />
            <p className="font-display text-xl leading-relaxed text-nicchyo-ink sm:text-2xl">
              高知高専生がつくった、
              <br />
              日曜市のデジタルマップ。
            </p>
            <p className="mt-4 text-base leading-loose text-nicchyo-ink/70">
              nicchyo（ニッチョ）は、高知工業高等専門学校の学生と顧問の教員が開発している、高知・日曜市のデジタルマップです。
              地図でお店を探す。品物やジャンルでしぼる。わからないことは AI の「にちよさん」に聞く。
              はじめて日曜市を訪れる人が、迷わず楽しめるようにつくっています。
            </p>
            <p className="mt-5 flex items-start gap-2 border-l-[3px] border-nicchyo-primary pl-3 text-sm font-bold leading-relaxed text-nicchyo-ink">
              <Award aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              こうちNPOアワード2025「ワカモノ未来賞」受賞
            </p>
            <Link
              href="/activities"
              className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:text-amber-600"
            >
              これまでの取り組みを見る
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
