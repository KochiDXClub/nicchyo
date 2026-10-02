"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Camera, CalendarDays, Heart, Mail, Sparkles } from "lucide-react";
import type { TourScene } from "@/lib/vendor/tours";

/**
 * 説明パネルの絵。画面の写真ではなく、形だけの簡単な図をコードで描く
 * （画面の見た目が変わっても、この図は古くならない）。動きは「動きを減らす」設定のときは止める。
 */
export default function TourIllustration({ scene }: { scene: TourScene }) {
  const still = useReducedMotion();
  const pulse = still ? {} : { scale: [1, 1.06, 1] };
  const pulseTransition = { duration: 1.8, repeat: Infinity, ease: "easeInOut" as const };

  const scenes: Record<TourScene, ReactNode> = {
    chat: (
      <div className="flex w-full max-w-[16rem] flex-col gap-2">
        <motion.div
          className="ml-auto rounded-card rounded-br-md bg-amber-500 px-3 py-2 text-xs font-bold text-white"
          initial={still ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          営業時間を変えたい
        </motion.div>
        <motion.div
          className="flex items-center gap-1.5 rounded-card rounded-bl-md bg-white px-3 py-2 text-xs font-bold text-nicchyo-ink shadow-chip"
          initial={still ? false : { opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Sparkles size={14} className="text-amber-600" aria-hidden="true" />
          こうでええかえ？
        </motion.div>
      </div>
    ),
    form: (
      <div className="w-full max-w-[16rem] space-y-2">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-2 rounded-btn bg-white px-3 py-2 shadow-chip">
            <span className="h-2 w-12 rounded-full bg-nicchyo-ink/15" />
            <span className="h-2 flex-1 rounded-full bg-nicchyo-ink/10" />
            {row === 0 && (
              <motion.span
                className="h-2 w-6 rounded-full bg-amber-500"
                animate={pulse}
                transition={pulseTransition}
              />
            )}
          </div>
        ))}
      </div>
    ),
    camera: (
      <motion.div
        className="flex h-24 w-24 items-center justify-center rounded-card bg-white text-amber-600 shadow-lift"
        animate={pulse}
        transition={pulseTransition}
      >
        <Camera size={40} aria-hidden="true" />
      </motion.div>
    ),
    calendar: (
      <div className="w-full max-w-[14rem] rounded-card bg-white p-3 shadow-chip">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-nicchyo-ink/70">
          <CalendarDays size={14} aria-hidden="true" />
          日曜日
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 8 }, (_, i) => (
            <motion.span
              key={i}
              className={i === 5 ? "h-6 rounded-btn bg-amber-500" : "h-6 rounded-btn bg-nicchyo-ink/10"}
              animate={i === 5 ? pulse : {}}
              transition={pulseTransition}
            />
          ))}
        </div>
      </div>
    ),
    chart: (
      <div className="flex h-24 items-end gap-2" role="presentation">
        {[40, 64, 96, 72, 48].map((height, i) => (
          <motion.span
            key={i}
            className={i === 2 ? "w-7 rounded-t-btn bg-amber-500" : "w-7 rounded-t-btn bg-amber-200"}
            style={{ height }}
            initial={still ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
          />
        ))}
      </div>
    ),
    mail: (
      <motion.div
        className="flex h-24 w-32 items-center justify-center rounded-card bg-white text-amber-600 shadow-lift"
        animate={still ? {} : { y: [0, -6, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Mail size={40} aria-hidden="true" />
      </motion.div>
    ),
    memory: (
      <div className="flex items-center gap-3">
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-amber-600 shadow-lift"
          animate={pulse}
          transition={pulseTransition}
        >
          <Sparkles size={28} aria-hidden="true" />
        </motion.div>
        <div className="space-y-1.5">
          <span className="block h-2 w-24 rounded-full bg-nicchyo-ink/15" />
          <span className="block h-2 w-16 rounded-full bg-nicchyo-ink/10" />
        </div>
      </div>
    ),
    history: (
      <div className="w-full max-w-[16rem] space-y-2">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center gap-3 rounded-btn bg-white p-2 shadow-chip">
            <span className="h-10 w-10 rounded-btn bg-amber-200" />
            <span className="flex-1 space-y-1.5">
              <span className="block h-2 w-20 rounded-full bg-nicchyo-ink/15" />
              <span className="block h-2 w-12 rounded-full bg-nicchyo-ink/10" />
            </span>
            {row === 0 && <Heart size={16} className="text-rose-400" aria-hidden="true" />}
          </div>
        ))}
      </div>
    ),
  };

  return (
    <div
      className="flex h-44 items-center justify-center rounded-card bg-amber-50 px-4 ring-1 ring-line-warm"
      aria-hidden="true"
    >
      {scenes[scene]}
    </div>
  );
}
