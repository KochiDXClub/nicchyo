import { CloudRain, Sun } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { getStatusPresentation } from "@/lib/market/calendar";
import { getLocale, getT } from "@/lib/i18n/server";
import { isOff, monthLabel, type LandingMarketDay } from "./upcomingMarketDays";
import "./landing.css";

/**
 * これからの日曜の1枚（カレンダーから吊るした札）。開催カレンダー（market_days）の状態つき。
 * 荒天中止・臨時休市は灰色。「次の日曜市は、いつ？」とトップの写真の上で同じ見た目を使う
 */
export default async function MarketDateCard({ marketDay }: { marketDay: LandingMarketDay }) {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const off = isOff(marketDay.status);
  const statusLabel = t(getStatusPresentation(marketDay.status).label);
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
      <span className={cn("text-[11px] font-bold", off ? "text-nicchyo-ink/40" : "text-amber-800")}>{monthLabel(marketDay.month, locale)}</span>
      <span className={cn("font-display text-[1.75rem] leading-[1.1]", off ? "text-nicchyo-ink/40" : "text-nicchyo-ink")}>{marketDay.day}</span>
      {marketDay.marketName && <span className="max-w-full truncate text-[10px] font-bold">{t(marketDay.marketName)}</span>}
      {off ? (
        <CloudRain aria-hidden className="my-0.5 h-[22px] w-[22px] text-nicchyo-ink/40" />
      ) : (
        <Sun aria-hidden className="my-0.5 h-[22px] w-[22px] text-amber-400" />
      )}
      <span className={cn("text-[11px] font-black", off ? "text-nicchyo-ink/55" : "text-green-800")}>
        {statusLabel}
      </span>
    </li>
  );
}
