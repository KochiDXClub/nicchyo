import Image from "next/image";
import Link from "next/link";
import { CalendarDays, CircleHelp } from "lucide-react";
import { PageContainer, Surface, buttonClass } from "@/components/ui";
import { MARKET_FACTS } from "./content";

/**
 * 日曜市そのものの紹介。検索から来た人が「日曜市とは」を読めるよう、文字で書いておく
 * （地図は描画が JavaScript 頼みで、検索エンジンが読める文章がほとんど無いため）
 */
export default function LandingMarketInfo() {
  return (
    <section aria-labelledby="landing-market" className="mt-20">
      <PageContainer width="wide" className="grid gap-8 md:grid-cols-2 md:items-center md:gap-12">
        <div className="grid h-64 grid-cols-[1.35fr_1fr] gap-3 sm:h-80">
          <Image
            src="/images/intro/sunday-market-street-stalls.webp"
            alt="テントの屋台が続く、追手筋の日曜市"
            width={1280}
            height={960}
            sizes="(min-width: 768px) 18rem, 55vw"
            className="h-full w-full rounded-card object-cover shadow-card"
          />
          <Image
            src="/images/intro/sunday-market-otepia-overview.webp"
            alt="上から見た日曜市。並木道に沿って屋台が並んでいる"
            width={960}
            height={1280}
            sizes="(min-width: 768px) 13rem, 40vw"
            className="h-full w-full rounded-card object-cover shadow-card"
          />
        </div>

        <div>
          <p className="text-sm font-bold tracking-wide text-amber-700">はじめての方へ</p>
          <h2 id="landing-market" className="mt-2 font-display text-2xl leading-snug text-nicchyo-ink sm:text-3xl">
            日曜市って、
            <br />
            どんなところ？
          </h2>
          <Surface as="dl" elevation="flat" className="mt-5 divide-y divide-line">
            {MARKET_FACTS.map((fact) => (
              <div key={fact.term} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                <dt className="w-24 shrink-0 border-l-[3px] border-nicchyo-primary pl-2 text-sm font-bold text-nicchyo-ink">
                  {fact.term}
                </dt>
                <dd className="text-sm leading-relaxed text-nicchyo-ink/70">{fact.detail}</dd>
              </div>
            ))}
          </Surface>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/calendar" className={buttonClass({ variant: "quiet" })}>
              <CalendarDays aria-hidden className="h-4 w-4" />
              開催カレンダー
            </Link>
            <Link href="/faq" className={buttonClass({ variant: "quiet" })}>
              <CircleHelp aria-hidden className="h-4 w-4" />
              よくある質問
            </Link>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
