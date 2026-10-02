"use client";

import { Check, Send } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Box, Finger, POP_IN, SURFACE, useTyped, type Rect, type SceneProps } from "../primitives";

const VARIANTS = {
  hours: { say: "営業時間を9時から15時にしたい", label: "営業時間", value: "9:00 〜 15:00" },
  payment: { say: "PayPayも使えるようにしたい", label: "支払い方法", value: "現金・PayPay" },
} as const;

const INPUT: Rect = { x: 10, y: 158, w: 300, h: 34 };
const SEND: Rect = { x: 278, y: 162, w: 26, h: 26 };
const USER_BUBBLE: Rect = { x: 56, y: 10, w: 254, h: 26 };
const REPLY_BUBBLE: Rect = { x: 10, y: 44, w: 128, h: 24 };
const CARD: Rect = { x: 10, y: 74, w: 262, h: 74 };
const SAVE: Rect = { x: 184, y: 112, w: 78, h: 26 };
const HINT: Rect = { x: 10, y: 14, w: 196, h: 24 };

/**
 * 話しかけて、変更案が出て、確かめて保存する。工程: 0 話しかける / 1 打って送る / 2 案が出る / 3 保存で反映。
 * 保存するまでお店の情報が変わらないことを、保存ボタンを押す工程で見せる。
 */
export function ChatScene({ step, variant }: SceneProps & { variant: keyof typeof VARIANTS }) {
  const v = VARIANTS[variant];
  const typed = useTyped(v.say, step === 1 ? "typing" : "idle");
  const proposed = step >= 2;
  const saved = step === 3;
  const finger = step === 0 ? INPUT : step === 1 ? SEND : SAVE;

  return (
    <>
      {!proposed && (
        <Box key="hint" rect={HINT} {...POP_IN} className={cn(SURFACE, "flex items-center rounded-card rounded-bl-sm px-3 text-[11px] font-bold text-nicchyo-ink")}>
          変えたいことを話してや
        </Box>
      )}
      {proposed && (
        <Box rect={USER_BUBBLE} {...POP_IN} className="flex items-center rounded-card rounded-br-sm bg-amber-500 px-3 text-[11px] font-bold text-white">
          {v.say}
        </Box>
      )}
      {proposed && (
        <Box rect={REPLY_BUBBLE} {...POP_IN} transition={{ ...POP_IN.transition, delay: 0.25 }} className={cn(SURFACE, "flex items-center rounded-card rounded-bl-sm px-3 text-[11px] font-bold text-nicchyo-ink")}>
          こうでええかえ？
        </Box>
      )}
      {proposed && (
        <Box rect={CARD} {...POP_IN} transition={{ ...POP_IN.transition, delay: 0.5 }} className={cn(SURFACE, "px-3 pt-2")}>
          <p className="text-[10px] font-bold text-nicchyo-ink/55">{v.label}</p>
          <p className="mt-0.5 text-[15px] font-bold text-nicchyo-ink">{v.value}</p>
        </Box>
      )}
      {proposed && (
        <Box
          rect={SAVE}
          initial={false}
          animate={{ scale: saved ? 1 : [1, 1.05, 1] }}
          transition={saved ? { duration: 0.2 } : { duration: 1.4, repeat: Infinity }}
          className={cn(
            "z-10 flex items-center justify-center gap-1 rounded-chip text-[11px] font-bold text-white transition-colors duration-300",
            saved ? "bg-status-good-fg" : "bg-amber-500"
          )}
        >
          {saved ? (
            <>
              <Check size={12} aria-hidden="true" />
              保存した
            </>
          ) : (
            "保存"
          )}
        </Box>
      )}

      <Box rect={INPUT} className={cn(SURFACE, "flex items-center rounded-chip pl-3 pr-10 text-[11px]")}>
        {typed ? (
          <span className="font-bold text-nicchyo-ink">
            {typed}
            <span className="ml-px inline-block h-3 w-px animate-pulse bg-amber-500 align-middle" />
          </span>
        ) : (
          <span className="text-nicchyo-ink/40">にちよさんに話しかける</span>
        )}
      </Box>
      <Box
        rect={SEND}
        initial={false}
        animate={{ scale: step === 1 && typed.length >= v.say.length ? [1, 1.12, 1] : 1 }}
        transition={{ duration: 0.8, repeat: Infinity }}
        className={cn("flex items-center justify-center rounded-full text-white", step === 1 ? "bg-amber-500" : "bg-nicchyo-ink/20")}
      >
        <Send size={13} aria-hidden="true" />
      </Box>

      <Finger target={finger} pressed={step === 0 || step === 3} />
    </>
  );
}
