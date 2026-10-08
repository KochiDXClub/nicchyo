"use client";

import { Check, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Box, Finger, POP_IN, SURFACE, type Rect, type SceneProps } from "../primitives";

const SAY: Rect = { x: 70, y: 10, w: 240, h: 26 };
const ASK: Rect = { x: 10, y: 44, w: 300, h: 66 };
const YES: Rect = { x: 196, y: 80, w: 106, h: 24 };
const SKIP: Rect = { x: 150, y: 80, w: 40, h: 24 };
const NOTE: Rect = { x: 14, y: 120, w: 292, h: 70 };

/** 話したことが覚えごとになる。工程: 0 話して聞かれる / 1 「これでええ！」/ 2 覚えごとに入る */
export function MemoryLearnScene({ step }: SceneProps) {
  const done = step === 2;
  return (
    <>
      <Box rect={SAY} {...POP_IN} className="flex items-center rounded-card rounded-br-sm bg-amber-500 px-3 text-[11px] font-bold text-white">
        10時前は空いちょるよ
      </Box>
      <Box rect={ASK} {...POP_IN} transition={{ ...POP_IN.transition, delay: 0.4 }} className={cn(SURFACE, "px-3 pt-2")}>
        <p className="flex items-center gap-1 text-[11px] font-bold text-nicchyo-ink">
          <Sparkles size={12} aria-hidden="true" className="text-amber-600" />
          これ、覚えちょいてもかまん？
        </p>
        <p className="mt-px text-[9px] text-nicchyo-ink/55">お客さんに聞かれたときの案内に使うで。</p>
      </Box>
      <Box rect={SKIP} className="z-10 flex items-center justify-center text-[10px] font-bold text-nicchyo-ink/55">
        いらん
      </Box>
      <Box
        rect={YES}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0, scale: step === 1 ? 0.94 : 1 }}
        transition={{ delay: step === 0 ? 0.8 : 0 }}
        className={cn(
          "z-10 flex items-center justify-center rounded-chip text-[11px] font-bold text-white transition-colors duration-300",
          done ? "bg-status-good-fg" : "bg-amber-500"
        )}
      >
        {done ? "覚えたで" : "これでええ！"}
      </Box>

      {!done && (
        <Box rect={NOTE} className="flex items-center justify-center rounded-btn border-2 border-dashed border-amber-300 text-[10px] font-bold text-amber-700/70">
          覚えごとの一覧（ここに入ります）
        </Box>
      )}
      {done && (
        <Box key="note" rect={NOTE} initial={{ opacity: 0, y: -40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 160, damping: 16 }} className={cn(SURFACE, "px-3 pt-2")}>
          <p className="flex items-center gap-1 text-[11px] font-bold text-nicchyo-ink">
            <Check size={12} aria-hidden="true" className="text-status-good-fg" />
            空いている時間
          </p>
          <p className="mt-1 text-[11px] text-nicchyo-ink/70">10時前は空いています</p>
          <p className="mt-1.5 inline-block rounded-chip bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-900">
            お客さんへの案内
          </p>
        </Box>
      )}
      <Finger target={step === 0 ? null : YES} pressed={step === 1} />
    </>
  );
}

const CARD: Rect = { x: 14, y: 10, w: 292, h: 112 };
const TOGGLE_A: Rect = { x: 256, y: 52, w: 36, h: 20 };
const TOGGLE_B: Rect = { x: 256, y: 84, w: 36, h: 20 };
const FORGET: Rect = { x: 14, y: 136, w: 292, h: 34 };

function Switch({ rect, on }: { rect: Rect; on: boolean }) {
  return (
    <Box rect={rect} className={cn("z-10 rounded-full transition-colors duration-300", on ? "bg-amber-500" : "bg-nicchyo-ink/20")}>
      <Box
        rect={{ x: 0, y: 2, w: 16, h: 16 }}
        initial={false}
        animate={{ x: on ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 380, damping: 24 }}
        className="rounded-full bg-white shadow-chip"
      />
    </Box>
  );
}

/** 覚えごとの使い道と、忘れさせる。工程: 0 使い道は2つ / 1 オフにする / 2 忘れさせる */
export function MemoryToggleScene({ step }: SceneProps) {
  const forgotten = step === 2;
  return (
    <>
      <Box rect={CARD} animate={{ opacity: forgotten ? 0.25 : 1 }} className={cn(SURFACE, "px-3 pt-2")}>
        <p className="text-[11px] font-bold text-nicchyo-ink">空いている時間</p>
      </Box>
      <Box rect={{ x: 26, y: 34, w: 200, h: 14 }} animate={{ opacity: forgotten ? 0.25 : 1 }} className="text-[10px] font-semibold text-nicchyo-ink/70">
        どこで使う？
      </Box>
      <Box rect={{ x: 26, y: 52, w: 200, h: 20 }} animate={{ opacity: forgotten ? 0.25 : 1 }} className="flex items-center text-[11px] font-bold text-nicchyo-ink">
        お客さんへの案内
      </Box>
      <Box rect={{ x: 26, y: 84, w: 200, h: 20 }} animate={{ opacity: forgotten ? 0.25 : 1 }} className="flex items-center text-[11px] font-bold text-nicchyo-ink">
        自分の相談
      </Box>
      <Switch rect={TOGGLE_A} on={step === 0} />
      <Switch rect={TOGGLE_B} on />
      {forgotten ? (
        <Box key="gone" rect={FORGET} {...POP_IN} className="flex items-center justify-center rounded-btn bg-white text-[11px] font-bold text-nicchyo-ink/70 shadow-chip ring-1 ring-line">
          忘れました
        </Box>
      ) : (
        <Box rect={FORGET} className="flex items-center justify-center gap-1.5 rounded-btn bg-white text-[11px] font-bold text-rose-600 shadow-chip ring-1 ring-rose-200">
          <Trash2 size={13} aria-hidden="true" />
          にちよさんに忘れさせる
        </Box>
      )}
      <Finger target={step === 0 ? null : step === 1 ? TOGGLE_A : FORGET} pressed={step >= 1} />
    </>
  );
}
