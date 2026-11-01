import { CloudRain, Sun } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { getStatusPresentation } from "@/lib/market/calendar";
import type { LandingSunday } from "./upcomingSundays";
import "./landing.css";

/** 開催しない日（荒天中止・臨時休市）か */
export function isOff(status: LandingSunday["status"]) {
  return status === "cancelled" || status === "closed";
}

/**
 * これからの日曜の1枚（カレンダーから吊るした札）。開催カレンダー（market_days）の状態つき。
 * 荒天中止・臨時休市は灰色。「次の日曜市は、いつ？」とトップの写真の上で同じ見た目を使う
 */
export default function SundayCard({ sunday }: { sunday: LandingSunday }) {
  const off = isOff(sunday.status);
  return (
    <li
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
}
