import Link from "next/link";
import { Clock, CloudRain, MapPin, Ruler, Sun } from "lucide-react";
import { PageContainer } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { getStatusPresentation } from "@/lib/market/calendar";
import { MARKET_FACTS } from "./content";
import SectionHeading from "./SectionHeading";
import type { LandingSunday } from "./upcomingSundays";

const FACT_ICONS = { いつ: Clock, どこ: MapPin, 広さ: Ruler } as const;

/** 開催しない日（荒天中止・臨時休市）か */
function isOff(status: LandingSunday["status"]) {
  return status === "cancelled" || status === "closed";
}

/**
 * 次の日曜市は、いつ？ 次の日曜を大きく見せ、これからの日曜を、
 * 開催カレンダー（market_days）の状態つきで横に並べる（荒天中止・臨時休市は灰色）。
 * いつ・どこ・広さは、その下に1行ずつ
 */
export default function LandingInfo({ sundays }: { sundays: LandingSunday[] }) {
  const next = sundays[0];
  if (!next) return null;
  const nextStatus = getStatusPresentation(next.status);

  return (
    <section aria-labelledby="landing-info" className="mt-20 md:mt-28">
      <PageContainer width="wide">
        <SectionHeading id="landing-info">次の日曜市は、いつ？</SectionHeading>

        <div className="mt-8 grid items-start gap-8 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10">
          {/* 次の日曜 */}
          <div
            className="flex flex-col items-center rounded-card bg-white px-6 py-7 shadow-card ring-1 ring-line"
            role="img"
            aria-label={`次の日曜市は${next.month}月${next.day}日、${nextStatus.label}`}
          >
            <span className="text-base font-bold text-nicchyo-ink/70">{next.month}月</span>
            <span className="text-[5.5rem] font-black leading-none text-nicchyo-ink">{next.day}</span>
            <span className="mt-1 text-base font-bold text-nicchyo-ink/70">日曜日</span>
            <span
              className={cn(
                "mt-3 rounded-chip px-4 py-1 text-sm font-black",
                isOff(next.status) ? "bg-nicchyo-ink/5 text-nicchyo-ink/55" : "bg-nicchyo-primary/15 text-nicchyo-ink"
              )}
            >
              {nextStatus.label}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[15px] font-black text-nicchyo-ink">これからの日曜</p>
              <Link href="/calendar" className="text-[13px] font-bold text-amber-700 hover:text-amber-600">
                開催カレンダー →
              </Link>
            </div>
            <ul className="-mx-5 mt-3 flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sundays.map((sunday) => {
                const off = isOff(sunday.status);
                return (
                  <li
                    key={sunday.dateIso}
                    className={cn(
                      "flex w-[4.75rem] shrink-0 flex-col items-center gap-px rounded-card px-1.5 py-2.5",
                      off ? "bg-nicchyo-ink/5" : "bg-white ring-1 ring-line"
                    )}
                  >
                    <span className={cn("text-[11px] font-bold", off ? "text-nicchyo-ink/40" : "text-nicchyo-ink/70")}>{sunday.month}月</span>
                    <span className={cn("text-[1.75rem] font-black leading-[1.1]", off ? "text-nicchyo-ink/40" : "text-nicchyo-ink")}>{sunday.day}</span>
                    {off ? (
                      <CloudRain aria-hidden className="my-0.5 h-5 w-5 text-nicchyo-ink/40" />
                    ) : (
                      <Sun aria-hidden className="my-0.5 h-5 w-5 text-amber-500" />
                    )}
                    <span className={cn("text-[11px] font-bold", off ? "text-nicchyo-ink/55" : "text-nicchyo-ink/80")}>
                      {getStatusPresentation(sunday.status).label}
                    </span>
                  </li>
                );
              })}
            </ul>

            <dl className="mt-5 divide-y divide-line rounded-card bg-white ring-1 ring-line">
              {MARKET_FACTS.map((fact) => {
                const Icon = FACT_ICONS[fact.term];
                return (
                  <div key={fact.term} className="flex items-center gap-3 px-4 py-3">
                    <Icon aria-hidden className="h-5 w-5 shrink-0 text-nicchyo-ink/55" />
                    <dt className="w-10 shrink-0 text-xs font-bold text-nicchyo-ink/55">{fact.term}</dt>
                    <dd className="text-[15px] font-bold text-nicchyo-ink">{fact.detail}</dd>
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
