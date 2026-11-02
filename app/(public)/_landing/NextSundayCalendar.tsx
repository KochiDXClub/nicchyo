import { cn } from "@/lib/utils/cn";
import { getStatusPresentation } from "@/lib/market/calendar";
import { isOff } from "./SundayCard";
import type { LandingSunday } from "./upcomingSundays";
import "./landing.css";

/**
 * 日めくりカレンダー（次の日曜）。後ろに2枚重ねる。
 * 「次の日曜市は、いつ？」と、PCのトップの写真の上で同じ見た目を使う
 */
export default function NextSundayCalendar({ sunday: next, className }: { sunday: LandingSunday; className?: string }) {
  const nextStatus = getStatusPresentation(next.status);
  return (
    <div className={cn("relative mx-auto h-[15.6rem] w-[14.4rem]", className)} role="img" aria-label={`次の日曜市は${next.month}月${next.day}日、${nextStatus.label}`}>
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
  );
}
