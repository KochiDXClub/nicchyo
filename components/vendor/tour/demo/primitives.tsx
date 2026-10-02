"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** デモは 320×200 の仮の座標で描き、舞台の幅に合わせて拡大・縮小する（スマホの幅でも崩れない） */
export const STAGE_W = 320;
export const STAGE_H = 200;

export type Rect = { x: number; y: number; w: number; h: number };

export type SceneProps = { step: number };

/** 舞台。中は仮の座標（左上が 0,0）。画面の読み上げには出さない（下の字幕が同じ内容を言うため） */
export function DemoStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const width = element.clientWidth;
      if (width > 0) setScale(width / STAGE_W);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="relative mx-auto w-full max-w-[24rem] select-none overflow-hidden rounded-card bg-amber-50 ring-1 ring-line-warm"
      style={{ aspectRatio: `${STAGE_W} / ${STAGE_H}` }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

/** 仮の座標で置く箱。動きは framer-motion の props（initial / animate）で付ける */
export function Box({
  rect,
  className,
  style,
  children,
  ...rest
}: { rect: Rect; className?: string; style?: CSSProperties; children?: ReactNode } & Omit<
  HTMLMotionProps<"div">,
  "style" | "className" | "children"
>) {
  return (
    <motion.div
      className={cn("absolute", className)}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, ...style }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** 白い面。ヘッダー無しの小さなカード */
export const SURFACE = "rounded-btn bg-white shadow-chip ring-1 ring-line";

/** 文字の代わりの灰色の棒（中身は読ませない行） */
export function Bar({ rect, className }: { rect: Rect; className?: string }) {
  return <Box rect={rect} className={cn("rounded-full bg-nicchyo-ink/10", className)} />;
}

/**
 * タップするカーソル（矢印）。先端が target の中の指す位置にあり、対象の文字を隠さない。
 * pressed のとき押す（縮んで波紋が広がる）。target が null なら隠れる。
 * 「動きを減らす」設定のときは動かさず、その場に出す。
 */
export function Finger({ target, pressed = false }: { target: Rect | null; pressed?: boolean }) {
  const reduce = useReducedMotion();
  // 先端は、対象の右寄り・下寄り（文字の多い左上を避ける）
  const tip = target
    ? { x: target.x + target.w * 0.72, y: target.y + target.h * 0.62 }
    : { x: STAGE_W - 24, y: STAGE_H + 24 };

  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 z-30 h-0 w-0"
      initial={false}
      animate={{ x: tip.x, y: tip.y, opacity: target ? 1 : 0 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 130, damping: 17 }}
    >
      {pressed && !reduce && (
        <motion.span
          className="absolute -left-4 -top-4 h-8 w-8 rounded-full bg-amber-400/40 ring-2 ring-amber-500"
          initial={{ scale: 0.3, opacity: 0.9 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.7 }}
        />
      )}
      <motion.span
        className="absolute left-0 top-0 block origin-top-left"
        initial={false}
        animate={{ scale: pressed ? 0.82 : 1 }}
        transition={{ duration: 0.15 }}
      >
        <MousePointer2 size={26} strokeWidth={1.6} className="fill-white text-nicchyo-ink drop-shadow-md" aria-hidden="true" />
      </motion.span>
    </motion.div>
  );
}

/**
 * 文字が打たれていく動き。mode が "typing" になったら頭から打ち、"done" なら全部、"idle" なら空。
 * 「動きを減らす」設定のときは、打たずに全部出す。
 */
export function useTyped(text: string, mode: "idle" | "typing" | "done"): string {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (mode !== "typing" || reduce) return;
    setCount(0);
    const id = window.setInterval(() => {
      setCount((value) => {
        if (value >= text.length) {
          window.clearInterval(id);
          return value;
        }
        return value + 1;
      });
    }, 75);
    return () => window.clearInterval(id);
  }, [mode, text, reduce]);

  if (mode === "idle") return "";
  if (mode === "done" || reduce) return text;
  return text.slice(0, count);
}

/** 工程が進んだときに、ふわっと出る動き（y 方向に少し持ち上がる） */
export const POP_IN = {
  initial: { opacity: 0, y: 8, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: "spring" as const, stiffness: 260, damping: 22 },
};
