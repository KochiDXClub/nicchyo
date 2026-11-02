import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { PageContainer } from "@/components/ui";
import { MARKET_FACTS } from "./content";
import SectionHeading from "./SectionHeading";
import NextSundayCalendar from "./NextSundayCalendar";
import SundayCard from "./SundayCard";
import type { LandingSunday } from "./upcomingSundays";
import "./landing.css";

const FACT_ICONS = { いつ: Clock, どこ: MapPin } as const;

/**
 * 次の日曜市は、いつ？ 次の日曜を日めくりカレンダーで大きく見せ、これからの日曜を、
 * 開催カレンダー（market_days）の状態つきで横に並べる（荒天中止・臨時休市は灰色）。
 * 「いつ」「どこ」は、綱からぶら下がる木の看板
 */
export default function LandingInfo({ sundays }: { sundays: LandingSunday[] }) {
  const next = sundays[0];
  if (!next) return null;

  return (
    <section aria-labelledby="landing-info" className="mt-20 md:mt-28">
      <PageContainer width="wide">
        <SectionHeading id="landing-info">次の日曜市は、いつ？</SectionHeading>

        <div className="mt-8 grid items-center gap-8 md:grid-cols-[15.5rem_minmax(0,1fr)] md:gap-11">
          <NextSundayCalendar sunday={next} />

          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[15px] font-black text-nicchyo-ink">これからの日曜</p>
              <Link href="/calendar" className="text-[13px] font-bold text-amber-700 hover:text-amber-600">
                開催カレンダー →
              </Link>
            </div>
            <ul className="-mx-5 mt-3 flex gap-2.5 overflow-x-auto px-5 pb-3.5 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sundays.map((sunday) => (
                <SundayCard key={sunday.dateIso} sunday={sunday} />
              ))}
            </ul>

            {/* いつ・どこ：綱からぶら下がる木の看板 */}
            <dl className="mt-3.5 grid gap-[22px] pt-3 md:grid-cols-2 md:gap-3.5">
              {MARKET_FACTS.map((fact) => {
                const Icon = FACT_ICONS[fact.term];
                return (
                  <div key={fact.term} className="landing-sign relative flex items-center gap-3 rounded-btn px-4 py-3.5">
                    <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-2 border-amber-900 bg-amber-50 text-amber-900">
                      <Icon aria-hidden className="h-5 w-5" />
                    </span>
                    <span>
                      <dt className="text-[11px] font-bold opacity-75">{fact.term}</dt>
                      <dd className="text-base font-black md:text-[17px]">{fact.detail}</dd>
                    </span>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
