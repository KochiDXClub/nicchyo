import Link from "next/link";
import { Clock, CloudRain, MapPin, Sun } from "lucide-react";
import { PageContainer } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { getStatusPresentation } from "@/lib/market/calendar";
import { MARKET_FACTS } from "./content";
import SectionHeading from "./SectionHeading";
import type { LandingSunday } from "./upcomingSundays";

const FACT_ICONS = { いつ: Clock, どこ: MapPin } as const;

/** 開催しない日（荒天中止・臨時休市）か */
function isOff(status: LandingSunday["status"]) {
  return status === "cancelled" || status === "closed";
}

/**
 * 次の日曜市は、いつ？ 次の日曜を日めくりカレンダーで大きく見せ、これからの日曜を、
 * 開催カレンダー（market_days）の状態つきで横に並べる（荒天中止・臨時休市は灰色）。
 * 「いつ」「どこ」は、綱からぶら下がる木の看板
 */
export default function LandingInfo({ sundays }: { sundays: LandingSunday[] }) {
  const next = sundays[0];
  if (!next) return null;
  const nextStatus = getStatusPresentation(next.status);

  return (
    <section aria-labelledby="landing-info" className="mt-20 md:mt-28">
      <PageContainer width="wide">
        <SectionHeading id="landing-info">次の日曜市は、いつ？</SectionHeading>

        <div className="mt-8 grid items-center gap-8 md:grid-cols-[15.5rem_minmax(0,1fr)] md:gap-11">
          {/* 日めくりカレンダー（次の日曜）。後ろに2枚重ねる */}
          <div className="relative mx-auto h-[15.6rem] w-[14.4rem]" role="img" aria-label={`次の日曜市は${next.month}月${next.day}日、${nextStatus.label}`}>
            <span aria-hidden className="absolute inset-0 -translate-x-2 translate-y-1.5 -rotate-[5deg] rounded-card bg-white shadow-chip ring-1 ring-line-warm" />
            <span aria-hidden className="absolute inset-0 translate-x-2 translate-y-2 rotate-[5deg] rounded-card bg-nicchyo-accent/30 shadow-chip" />
            <span className="landing-cal-page absolute inset-0 flex flex-col items-center overflow-hidden rounded-card bg-white pt-3.5 shadow-lift">
              <span aria-hidden className="landing-cal-rings absolute -top-1.5 inset-x-0 z-[2] flex justify-center gap-11">
                <i /><i /><i />
              </span>
              <span className="landing-cal-head absolute inset-x-0 top-0 h-[3.6rem] bg-amber-400" />
              <span className="relative z-[1] mt-2 text-xl font-black tracking-widest text-white">{next.month}月</span>
              <span className="mt-5 font-display text-[6.5rem] leading-none text-nicchyo-ink">{next.day}</span>
              <span className="mt-1 text-[17px] font-black text-amber-700">日曜日</span>
              <span
                className={cn(
                  "mt-2.5 rounded-chip border px-[18px] py-0.5 text-sm font-black",
                  isOff(next.status) ? "border-line bg-nicchyo-ink/5 text-nicchyo-ink/55" : "border-lime-300 bg-lime-100 text-green-800"
                )}
              >
                {nextStatus.label}
              </span>
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[15px] font-black text-nicchyo-ink">これからの日曜</p>
              <Link href="/calendar" className="text-[13px] font-bold text-amber-700 hover:text-amber-600">
                開催カレンダー →
              </Link>
            </div>
            <ul className="-mx-5 mt-3 flex gap-2.5 overflow-x-auto px-5 pb-3.5 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sundays.map((sunday) => {
                const off = isOff(sunday.status);
                return (
                  <li
                    key={sunday.dateIso}
                    className={cn(
                      "landing-week relative flex w-[4.75rem] shrink-0 flex-col items-center gap-px rounded-card border px-1.5 pb-2.5 pt-[18px] shadow-chip transition-transform hover:-translate-y-1 hover:-rotate-[1.5deg] motion-reduce:transition-none",
                      off ? "border-line bg-nicchyo-ink/5 shadow-none" : "border-amber-200 bg-white"
                    )}
                  >
                    <span aria-hidden className="absolute inset-x-0 -top-[7px] flex justify-center gap-[18px]">
                      <i className="block h-[15px] w-[7px] rounded-sm bg-amber-900" />
                      <i className="block h-[15px] w-[7px] rounded-sm bg-amber-900" />
                    </span>
                    <span className={cn("text-[11px] font-bold", off ? "text-nicchyo-ink/40" : "text-amber-800")}>{sunday.month}月</span>
                    <span className={cn("font-display text-[1.75rem] leading-[1.1]", off ? "text-nicchyo-ink/40" : "text-nicchyo-ink")}>{sunday.day}</span>
                    {off ? (
                      <CloudRain aria-hidden className="my-0.5 h-[22px] w-[22px] text-nicchyo-ink/40" />
                    ) : (
                      <Sun aria-hidden className="my-0.5 h-[22px] w-[22px] text-amber-400" />
                    )}
                    <span className={cn("text-[11px] font-black", off ? "text-nicchyo-ink/55" : "text-green-800")}>
                      {getStatusPresentation(sunday.status).label}
                    </span>
                  </li>
                );
              })}
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
