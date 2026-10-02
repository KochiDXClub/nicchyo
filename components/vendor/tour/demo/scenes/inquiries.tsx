"use client";

import { Check, Mail, Send } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Box, Finger, POP_IN, SURFACE, useTyped, type Rect, type SceneProps } from "../primitives";

const TOPICS = ["質問", "報告・連絡", "相談"] as const;
const topic = (index: number): Rect => ({ x: 12 + index * 100, y: 10, w: 96, h: 28 });
const BODY: Rect = { x: 12, y: 48, w: 296, h: 50 };
const SEND: Rect = { x: 196, y: 108, w: 112, h: 30 };
const REPLY: Rect = { x: 12, y: 146, w: 296, h: 44 };
const SAY = "出店場所の相談をしたいです";

/** 運営に送る。工程: 0 種類 / 1 内容 / 2 送る / 3 返事が届く */
export function InquiriesSendScene({ step }: SceneProps) {
  const typed = useTyped(SAY, step === 1 ? "typing" : step >= 2 ? "done" : "idle");
  const finger = step === 0 ? topic(0) : step === 1 ? BODY : step === 2 ? SEND : null;

  return (
    <>
      {TOPICS.map((label, index) => (
        <Box
          key={label}
          rect={topic(index)}
          className={cn(
            "flex items-center justify-center rounded-chip text-[11px] font-bold transition-colors duration-300",
            index === 0 && step >= 1
              ? "bg-amber-500 text-white shadow-pop"
              : "bg-white text-nicchyo-ink/70 shadow-chip ring-1 ring-line"
          )}
        >
          {label}
        </Box>
      ))}
      <Box rect={BODY} className={cn(SURFACE, "px-3 py-2 text-[11px]")}>
        {typed ? <span className="font-bold text-nicchyo-ink">{typed}</span> : <span className="text-nicchyo-ink/40">内容を書く</span>}
      </Box>
      <Box
        rect={SEND}
        initial={false}
        animate={{ scale: step === 2 ? 0.94 : 1, opacity: step === 3 ? 0.5 : 1 }}
        className="flex items-center justify-center gap-1.5 rounded-chip bg-amber-500 text-[11px] font-bold text-white"
      >
        <Send size={12} aria-hidden="true" />
        送信する
      </Box>

      <AnimatePresence>
        {step === 2 && (
          <motion.span
            key="plane"
            className="absolute z-20 text-amber-600"
            style={{ left: SEND.x + 30, top: SEND.y + 6 }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: 150, y: -60, opacity: 0, scale: 0.6 }}
            transition={{ duration: 1.2, delay: 0.5, ease: "easeIn" }}
          >
            <Send size={20} aria-hidden="true" />
          </motion.span>
        )}
      </AnimatePresence>

      {step === 3 && (
        <Box key="reply" rect={REPLY} {...POP_IN} className={cn(SURFACE, "flex items-center gap-2.5 px-3 ring-status-good-line")}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-good-bg text-status-good-fg">
            <Mail size={15} aria-hidden="true" />
          </span>
          <span className="text-[11px] font-bold leading-snug text-nicchyo-ink">
            返信が届きました
            <span className="mt-0.5 flex items-center gap-1 text-[9px] font-normal text-nicchyo-ink/55">
              <Check size={10} aria-hidden="true" />
              この連絡ページで読めます
            </span>
          </span>
        </Box>
      )}
      <Finger target={finger} pressed={step === 0 || step === 2} />
    </>
  );
}
