import Image from "next/image";
import Link from "next/link";
import { MapPin, MessageCircle } from "lucide-react";
import { PageContainer, Surface, buttonClass } from "@/components/ui";
import { siteTextWithEmphasis } from "@/lib/siteCopy";

/**
 * 最初の一画面。チラシの表紙のつもりで、写真・見出し・地図への入口だけを置く。
 * 写真は文字の背景にしない（読みにくくなるうえ、上に重ねる幕が要る）。スナップ写真のように面で見せる
 */
export default function LandingHero() {
  return (
    <section aria-labelledby="landing-title" className="pt-[calc(1.5rem+var(--safe-top,0px))]">
      <PageContainer width="wide" className="grid items-center gap-8 md:grid-cols-[1fr_1.1fr] md:gap-10">
        <div className="md:order-2">
          <div className="relative mx-auto max-w-md md:max-w-none">
            <Surface elevation="lifted" padding="none" className="-rotate-2 p-2">
              <Image
                src="/images/home-hero.jpg"
                alt="野菜や品物が並ぶ、日曜市の屋台の通り"
                width={1191}
                height={941}
                priority
                sizes="(min-width: 768px) 34rem, 100vw"
                className="h-auto w-full rounded-btn object-cover"
              />
            </Surface>
            <p className="absolute -left-2 -top-4 flex h-20 w-20 rotate-[-12deg] flex-col items-center justify-center rounded-chip bg-nicchyo-accent text-center font-display leading-tight text-nicchyo-ink shadow-pop sm:h-24 sm:w-24">
              <span className="text-[0.7rem] sm:text-xs">毎週</span>
              <span className="text-xl sm:text-2xl">日曜</span>
            </p>
            <Image
              src="/images/obaasan_transparent.webp"
              alt=""
              width={768}
              height={768}
              sizes="7rem"
              className="absolute -bottom-6 -right-3 w-24 drop-shadow sm:w-28"
            />
          </div>
        </div>

        <div className="md:order-1">
          <p className="text-sm font-bold tracking-wide text-amber-700">高知・日曜市のデジタルマップ</p>
          <h1 id="landing-title" className="mt-2 font-display text-[2rem] leading-snug text-nicchyo-ink sm:text-4xl">
            日曜市を、
            <br />
            にちよさんと歩こう。
          </h1>
          <p className="mt-4 text-base leading-relaxed text-nicchyo-ink/70">
            {siteTextWithEmphasis("mapIntro.lead", "font-bold text-nicchyo-ink")}
          </p>
          <p className="mt-2 text-base leading-relaxed text-nicchyo-ink/70">
            nicchyo（ニッチョ）は、地図で店を探せて、わからないことはAIのにちよさんに聞ける、はじめての人のための案内です。
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/map" className={buttonClass({ size: "lg" })}>
              <MapPin aria-hidden className="h-5 w-5" />
              マップをひらく
            </Link>
            <Link href="/consult" className={buttonClass({ variant: "secondary", size: "lg" })}>
              <MessageCircle aria-hidden className="h-5 w-5" />
              にちよさんに聞く
            </Link>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
