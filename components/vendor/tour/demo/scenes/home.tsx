"use client";

import { Megaphone, Store, CalendarDays, Smile } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Bar, Box, Finger, POP_IN, SURFACE, type Rect, type SceneProps } from "../primitives";

const POST_BTN: Rect = { x: 10, y: 34, w: 146, h: 58 };
const STORE_BTN: Rect = { x: 164, y: 34, w: 146, h: 58 };
const TIP_LEFT: Rect = { x: 10, y: 102, w: 200, h: 70 };
const TIP_RIGHT: Rect = { x: 110, y: 102, w: 200, h: 70 };

/** 出店者トップの2つの大きなボタン。工程: 0 全体 / 1 近況を出す / 2 店舗情報を更新 */
export function HomeActionsScene({ step }: SceneProps) {
  return (
    <>
      <Bar rect={{ x: 10, y: 12, w: 110, h: 10 }} />
      <Box
        rect={POST_BTN}
        initial={false}
        animate={{ scale: step === 1 ? 1.04 : 1 }}
        className="flex flex-col items-center justify-center gap-1 rounded-panel bg-amber-500 text-[12px] font-bold text-white shadow-pop"
      >
        <Megaphone size={20} aria-hidden="true" />
        近況を出す
      </Box>
      <Box
        rect={STORE_BTN}
        initial={false}
        animate={{ scale: step === 2 ? 1.04 : 1 }}
        className="flex flex-col items-center justify-center gap-1 rounded-panel bg-white text-[12px] font-bold text-amber-800 shadow-card ring-1 ring-amber-200"
      >
        <Store size={20} aria-hidden="true" />
        店舗情報を更新
      </Box>

      {step === 1 && (
        <Box key="tip-post" rect={TIP_LEFT} {...POP_IN} className={cn(SURFACE, "px-3 py-2 text-[11px] font-bold leading-snug text-nicchyo-ink")}>
          今日のおすすめ
          <br />
          残りの数・場所の変更
          <p className="mt-1 text-[10px] font-normal text-nicchyo-ink/55">写真1枚で出せます</p>
        </Box>
      )}
      {step === 2 && (
        <Box key="tip-store" rect={TIP_RIGHT} {...POP_IN} className={cn(SURFACE, "px-3 py-2 text-[11px] font-bold leading-snug text-nicchyo-ink")}>
          お店の写真・主な商品
          <br />
          出店日
          <p className="mt-1 text-[10px] font-normal text-nicchyo-ink/55">会話で直せないものはここ</p>
        </Box>
      )}
      <Finger target={step === 1 ? POST_BTN : step === 2 ? STORE_BTN : null} pressed={step !== 0} />
    </>
  );
}

const DAYS = [
  { date: "10/4" },
  { date: "10/11" },
  { date: "10/18" },
  { date: "10/25" },
  { date: "11/1" },
] as const;
const TILE_Y = 52;
const tile = (index: number): Rect => ({ x: 13 + index * 60, y: TILE_Y, w: 54, h: 62 });
const OFF_INDEX = 2;

/** お休みする日曜日を押す。工程: 0 選ぶ / 1 お休みになる / 2 お客さんの画面にも出る */
export function ClosedDayScene({ step }: SceneProps) {
  const off = step >= 1;
  return (
    <>
      <Box rect={{ x: 14, y: 14, w: 120, h: 24 }} className="flex items-center gap-1.5 text-[12px] font-bold text-nicchyo-ink">
        <CalendarDays size={14} aria-hidden="true" className="text-amber-600" />
        出店する日曜日
      </Box>
      {DAYS.map((day, index) => {
        const isOff = off && index === OFF_INDEX;
        return (
          <Box
            key={day.date}
            rect={tile(index)}
            initial={false}
            animate={{ scale: index === OFF_INDEX && step === 0 ? 1.06 : 1 }}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-btn text-[11px] font-bold transition-colors duration-300",
              isOff ? "bg-nicchyo-ink/15 text-nicchyo-ink/55" : "bg-white text-nicchyo-ink shadow-chip ring-1 ring-line"
            )}
          >
            {day.date}
            <span
              className={cn(
                "rounded-chip px-1.5 py-px text-[9px]",
                isOff ? "bg-nicchyo-ink/55 text-white" : "bg-status-good-bg text-status-good-fg"
              )}
            >
              {isOff ? "お休み" : "出店"}
            </span>
          </Box>
        );
      })}
      <Box rect={{ x: 40, y: 130, w: 240, h: 54 }} className={cn(SURFACE, "px-3 py-2")}>
        <p className="text-[9px] font-bold text-nicchyo-ink/55">お客さんの画面</p>
        <p
          key={step === 2 ? "off" : "on"}
          className={cn("mt-1 flex items-center gap-1.5 text-[12px] font-bold", step === 2 ? "text-nicchyo-ink" : "text-nicchyo-ink/70")}
        >
          <Smile size={14} aria-hidden="true" className={step === 2 ? "text-amber-600" : "text-status-good-fg"} />
          {step === 2 ? "10/18 はお休みです" : "10/18 は出店します"}
        </p>
      </Box>
      <Finger target={step === 2 ? null : tile(OFF_INDEX)} pressed={step === 1} />
    </>
  );
}
