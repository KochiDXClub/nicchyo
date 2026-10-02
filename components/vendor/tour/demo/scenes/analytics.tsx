"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Heart, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Box, POP_IN, SURFACE, type Rect, type SceneProps } from "../primitives";

const HERO: Rect = { x: 14, y: 10, w: 292, h: 104 };
const TILE_A: Rect = { x: 14, y: 122, w: 142, h: 64 };
const TILE_B: Rect = { x: 164, y: 122, w: 142, h: 64 };
const VIEWS = 128;

/** この1週間の反応。工程: 0 見られた回数が数え上がる / 1 先週との違い / 2 おすすめ・ハート */
export function AnalyticsHeroScene({ step }: SceneProps) {
  const reduce = useReducedMotion();
  const value = useMotionValue(reduce ? VIEWS : 0);
  const shown = useTransform(value, (latest) => Math.round(latest).toLocaleString("ja-JP"));

  useEffect(() => {
    if (reduce) return;
    if (step === 0) {
      value.set(0);
      const controls = animate(value, VIEWS, { duration: 1.4, ease: "easeOut" });
      return () => controls.stop();
    }
    value.set(VIEWS);
  }, [step, reduce, value]);

  return (
    <>
      <Box rect={HERO} className={cn(SURFACE, "rounded-panel px-4 pt-3 shadow-lift")}>
        <p className="text-[10px] font-bold text-nicchyo-ink/70">この1週間、お店が見られた回数</p>
        <p className="mt-1 flex items-baseline gap-1">
          <motion.span className="text-[44px] font-bold leading-none tabular-nums text-nicchyo-ink">{shown}</motion.span>
          <span className="text-[14px] font-bold text-nicchyo-ink/70">回</span>
        </p>
      </Box>
      {step >= 1 && (
        <Box key="delta" rect={{ x: 150, y: 54, w: 144, h: 26 }} {...POP_IN} className="flex items-center justify-center gap-1 rounded-chip bg-status-good-bg text-[11px] font-bold text-status-good-fg">
          <TrendingUp size={13} aria-hidden="true" />
          先週より 12回多いです
        </Box>
      )}
      {[
        { rect: TILE_A, Icon: Sparkles, label: "にちよさんのおすすめ", value: "9回", delay: 0 },
        { rect: TILE_B, Icon: Heart, label: "もらったハート", value: "24個", delay: 0.15 },
      ].map(({ rect, Icon, label, value, delay }) => (
        <Box
          key={label}
          rect={rect}
          initial={false}
          animate={{ opacity: step >= 2 ? 1 : 0.4, y: step >= 2 ? 0 : 4 }}
          transition={{ type: "spring", stiffness: 260, damping: 22, delay: step >= 2 ? delay : 0 }}
          className={cn(SURFACE, "px-2.5 pt-2")}
        >
          <p className="flex items-center gap-1 whitespace-nowrap text-[9.5px] font-bold text-nicchyo-ink/70">
            <Icon size={12} aria-hidden="true" />
            {label}
          </p>
          <p className="mt-1 text-[20px] font-bold tabular-nums text-nicchyo-ink">{step >= 2 ? value : "—"}</p>
        </Box>
      ))}
    </>
  );
}

const QUESTIONS = [
  { text: "雨でもやってる？", count: 12 },
  { text: "いも天はどこ？", count: 8 },
  { text: "駐車場は？", count: 5 },
] as const;
const MAX_BAR = 120;
const SEARCHES = ["いも天", "トマト", "金魚", "ゆず"] as const;

/** お客さんの質問と、探されているもの。工程: 0 質問が並ぶ / 1 多い順に棒が伸びる / 2 探されているもの */
export function AnalyticsQuestionsScene({ step }: SceneProps) {
  return (
    <>
      <Box rect={{ x: 14, y: 8, w: 292, h: 100 }} className={cn(SURFACE, "px-3 pt-2")}>
        <p className="text-[10px] font-bold text-nicchyo-ink/70">お客さんが気になっていること</p>
      </Box>
      {QUESTIONS.map((q, index) => (
        <Box
          key={q.text}
          rect={{ x: 24, y: 32 + index * 24, w: 272, h: 20 }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.18 }}
          className="flex items-center gap-2 text-[11px] font-bold text-nicchyo-ink"
        >
          <span className="w-[92px] shrink-0">{q.text}</span>
          <span className="relative h-2.5 flex-1 rounded-full bg-nicchyo-ink/10">
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full bg-amber-500"
              initial={false}
              animate={{ width: step >= 1 ? (q.count / 12) * MAX_BAR : 6 }}
              transition={{ duration: 0.7, delay: index * 0.12, ease: "easeOut" }}
            />
          </span>
          {step >= 1 && <span className="w-6 text-right text-[10px] tabular-nums text-nicchyo-ink/70">{q.count}</span>}
        </Box>
      ))}
      <Box
        rect={{ x: 14, y: 116, w: 292, h: 72 }}
        initial={false}
        animate={{ opacity: step >= 2 ? 1 : 0.4 }}
        className={cn(SURFACE, "px-3 pt-2")}
      >
        <p className="text-[10px] font-bold text-nicchyo-ink/70">いま、探されているもの</p>
      </Box>
      {step >= 2 && (
        <>
          {SEARCHES.map((word, index) => (
            <Box
              key={word}
              rect={{ x: 24 + index * 68, y: 144, w: 62, h: 26 }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.2 + index * 0.12 }}
              className={cn(
                "z-10 flex items-center justify-center rounded-chip text-[11px] font-bold",
                index === 0 ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-900"
              )}
            >
              {word}
            </Box>
          ))}
        </>
      )}
    </>
  );
}
