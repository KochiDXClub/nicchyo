"use client";

import { Camera, ChevronRight, Clock, Heart, Link2, Package } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Bar, Box, Finger, SURFACE, type Rect, type SceneProps } from "../primitives";

const GROUPS = [
  { label: "お店の顔", Icon: Camera },
  { label: "品ぞろえ", Icon: Package },
  { label: "出店のこと", Icon: Clock },
  { label: "つながり", Icon: Link2 },
  { label: "こだわり", Icon: Heart },
] as const;
const ROW_H = 28;
const row = (index: number): Rect => ({ x: 10, y: 8 + index * 34, w: 300, h: ROW_H });
const TARGET = 2;
const SHEET: Rect = { x: 0, y: 62, w: 320, h: 138 };
const FIELD: Rect = { x: 16, y: 106, w: 288, h: 30 };
const SAVE: Rect = { x: 226, y: 150, w: 78, h: 30 };

/** 店舗情報の5つのまとまり。工程: 0 まとまり / 1 押す / 2 入力して保存 */
export function StoreGroupsScene({ step }: SceneProps) {
  return (
    <>
      {GROUPS.map(({ label, Icon }, index) => (
        <Box
          key={label}
          rect={row(index)}
          initial={false}
          animate={{ scale: step === 1 && index === TARGET ? 1.03 : 1 }}
          className={cn(
            SURFACE,
            "flex items-center gap-2 px-3 text-[12px] font-bold text-nicchyo-ink transition-colors duration-300",
            step >= 1 && index === TARGET && "bg-amber-100 ring-amber-300"
          )}
        >
          <Icon size={15} aria-hidden="true" className="text-amber-600" />
          {label}
          <ChevronRight size={14} aria-hidden="true" className="ml-auto text-nicchyo-ink/40" />
        </Box>
      ))}

      <AnimatePresence>
        {step === 2 && (
          <Box
            key="sheet"
            rect={SHEET}
            initial={{ y: SHEET.h }}
            animate={{ y: 0 }}
            exit={{ y: SHEET.h }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            className="z-10 rounded-t-sheet bg-nicchyo-base shadow-float ring-1 ring-line-warm"
          >
            <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-nicchyo-ink/15" />
            <p className="px-4 pt-3 text-[12px] font-bold text-nicchyo-ink">営業時間は？</p>
          </Box>
        )}
      </AnimatePresence>
      {step === 2 && (
        <>
          <Box
            rect={FIELD}
            initial={{ opacity: 0, y: SHEET.h }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.05 }}
            className={cn(SURFACE, "z-20 flex items-center px-3 text-[12px] font-bold text-nicchyo-ink")}
          >
            7:00 〜 13:00
          </Box>
          <Bar rect={{ x: 16, y: 144, w: 96, h: 8 }} className="z-20" />
          <Box
            rect={SAVE}
            initial={{ opacity: 0, y: SHEET.h }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.1 }}
            className="z-20 flex items-center justify-center rounded-chip bg-amber-500 text-[12px] font-bold text-white"
          >
            保存
          </Box>
        </>
      )}
      <Finger target={step === 0 ? null : step === 1 ? row(TARGET) : SAVE} pressed={step >= 1} />
    </>
  );
}
