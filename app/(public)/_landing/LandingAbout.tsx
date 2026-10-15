import Image from "next/image";
import Link from "next/link";
import { PageContainer } from "@/components/ui";
import { ABOUT, PHOTOS } from "./content";
import HandNote from "./HandNote";
import InView from "./InView";
import SectionHeading from "./SectionHeading";

/** 帯の上で漂う黄色い丸。位置と大きさ・ずれは見た目だけのもの */
const DOTS = [
  { x: 6, y: 18, d: 0, s: 10 },
  { x: 14, y: 70, d: 1.2, s: 14 },
  { x: 48, y: 12, d: 2.1, s: 8 },
  { x: 88, y: 26, d: 0.6, s: 12 },
  { x: 92, y: 74, d: 1.8, s: 9 },
  { x: 58, y: 86, d: 0.9, s: 11 },
] as const;

/**
 * 高知高専生がつくっています。あたたかい黄色の帯の上に、現地で活動する写真・受賞・開発チームのひとことを置く。
 * 受賞などの事実は活動記録（app/data/activities.ts）に載っているものだけを書く
 */
export default function LandingAbout() {
  return (
    <section aria-labelledby="landing-about" className="relative mt-24 bg-nicchyo-accent/25 py-20 md:mt-32 md:py-24">
      {/* 帯の上下の縁（波形） */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG */}
      <img src="/images/landing/art/band-top.svg" alt="" aria-hidden width={1440} height={50} className="absolute -top-[39px] left-0 block h-10 w-full" />
      {/* eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG */}
      <img src="/images/landing/art/band-bottom.svg" alt="" aria-hidden width={1440} height={50} className="absolute -bottom-[39px] left-0 block h-10 w-full" />
      <div aria-hidden className="landing-dots pointer-events-none absolute inset-0 overflow-hidden">
        {DOTS.map((dot) => (
          <i key={`${dot.x}-${dot.y}`} style={{ left: `${dot.x}%`, top: `${dot.y}%`, ["--d" as string]: dot.d, ["--s" as string]: `${dot.s}px` }} />
        ))}
      </div>

      <PageContainer width="wide" className="relative grid gap-9 md:grid-cols-2 md:items-center md:gap-14">
        <InView once className="relative">
          {/* ゆらゆら形が変わる枠（黄色い形が少しずれて重なる） */}
          <div aria-hidden className="landing-blob-back absolute -inset-3.5 right-3.5 bottom-3.5 -left-3.5 bg-nicchyo-accent" />
          <Image
            src={PHOTOS.survey.src}
            alt={PHOTOS.survey.alt}
            width={PHOTOS.survey.width}
            height={PHOTOS.survey.height}
            sizes="(min-width: 768px) 30rem, 100vw"
            className="landing-blob relative aspect-[4/3] w-full object-cover"
          />
          <span aria-hidden className="absolute -bottom-3 -right-1.5 z-[2] flex h-[5.4rem] w-[5.4rem] -rotate-12 items-center justify-center rounded-full border-2 border-dashed border-amber-500 bg-white text-center font-display text-sm leading-tight text-amber-800 shadow-lift">
            高知高専
          </span>
          {/* 過去の写真だと分かる言い方にする（今もアンケートをしているようには見せない） */}
          <HandNote size={26} delay={0.2} className="bottom-[12%] left-[6%] -rotate-6">
            アンケートのようす！
          </HandNote>
        </InView>

        <div>
          <SectionHeading id="landing-about">
            高知高専生が
            <br />
            つくっています
          </SectionHeading>
          <p className="mt-5 text-[15px] leading-loose text-nicchyo-ink/80">{ABOUT.body}</p>

          {/* 受賞：金のメダルのカード */}
          <div className="mt-5 flex items-center gap-3.5 rounded-sheet bg-white p-3 pr-5 shadow-lift ring-1 ring-line-warm">
            {/* eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG */}
            <img src="/images/landing/art/medal.svg" alt="" width={54} height={72} className="landing-medal h-[72px] w-[54px] shrink-0 drop-shadow-md" />
            <p className="flex flex-col items-start gap-0.5 text-left">
              <span className="text-[11px] font-bold text-amber-800">{ABOUT.awardName}</span>
              <span className="font-display text-xl leading-snug text-nicchyo-ink">{ABOUT.awardTitle}</span>
              <span className="rounded-chip bg-nicchyo-accent px-2.5 text-[11px] font-black text-nicchyo-ink">受賞</span>
            </p>
          </div>

          {/* 開発チームのひとこと：にちよさんの吹き出し */}
          <figure className="mt-5 flex items-end gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- 既存の透過 WebP */}
            <img src="/images/obaasan_transparent.webp" alt="" width={92} height={92} className="landing-sticker landing-bounce-y h-[92px] w-[92px] shrink-0 object-contain" />
            <div className="mb-3.5">
              <blockquote className="rounded-card rounded-bl-md border border-amber-200 bg-white px-[18px] py-3 text-left font-display text-xl leading-relaxed text-nicchyo-ink shadow-chip">
                {ABOUT.message.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </blockquote>
              <figcaption className="mt-1 pl-1 text-xs font-bold text-nicchyo-ink/55">{ABOUT.signature}</figcaption>
            </div>
          </figure>

          <Link
            href="/activities"
            className="mt-4 inline-flex h-11 items-center rounded-chip border border-amber-200 bg-white px-5 text-sm font-bold text-amber-800 shadow-chip transition hover:-translate-y-0.5 motion-reduce:transition-none"
          >
            これまでの取り組み →
          </Link>
        </div>
      </PageContainer>
    </section>
  );
}
