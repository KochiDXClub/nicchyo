"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import { resolveGrandmaPose } from "@/lib/grandma/pose";
import { useVendorAskInbox } from "./useVendorAsk";

/** 待っているあいだの、にちよさんの決まったひとこと */
const IDLE_LINE = "今日もおつかれさま！";

/**
 * 出店者トップの主役。
 *
 * 中央に大きなにちよさんが立ち、ふだんは吹き出しで決まったひとことを言っている。
 * 入力が要る質問があるときだけ、にちよさんの右上に受信箱のような吹き出し
 * （「！」と質問の数）を出す。押すと質問ページ（/my-shop/ask）へ移り、
 * にちよさんと質問だけの画面で答える。聞くことが無いときは吹き出しを出さない。
 *
 * 話し手は既定のにちよさんに固定する。質問文がにちよさんの口調で書かれているため、
 * 相談ページで選んだ別のキャラに切り替えると言葉遣いが合わなくなる。
 */
export default function VendorAskStage({ vendorId }: { vendorId: string }) {
  const { status, pendingCount } = useVendorAskInbox(vendorId);
  const reduceMotion = useReducedMotion() ?? false;
  const showInbox = status === "ready" && pendingCount > 0;

  const pose = resolveGrandmaPose({ isListening: false, isStreaming: false, aiStatus: "idle" });

  return (
    <section aria-label="にちよさん" className="flex flex-col items-center gap-4">
      <div className="consult-appear relative flex">
        <GrandmaAvatar pose={pose} size="hero" character={DEFAULT_CONSULT_CHARACTER} />

        {showInbox && (
          <motion.div
            className="absolute left-[60%] -top-2"
            initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
            animate={reduceMotion ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1, y: [0, -4, 0] }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    scale: { type: "spring", stiffness: 380, damping: 20 },
                    opacity: { duration: 0.15 },
                    y: { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
                  }
            }
          >
            <Link
              href="/my-shop/ask"
              aria-label={`にちよさんからの質問に答える（${pendingCount}つ）`}
              className="relative flex items-center gap-2 rounded-chip bg-white py-1.5 pl-1.5 pr-2.5 shadow-lift ring-1 ring-amber-200 transition active:scale-95 motion-reduce:active:scale-100"
            >
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-base font-black leading-none text-white"
              >
                !
              </span>
              <span aria-hidden className="whitespace-nowrap text-sm font-bold leading-none text-amber-900">
                質問が
                <span
                  data-testid="vendor-ask-inbox-count"
                  className="mx-0.5 text-lg tabular-nums text-amber-600"
                >
                  {pendingCount}
                </span>
                つ
              </span>
              <ChevronRight aria-hidden className="-ml-1 h-4 w-4 shrink-0 text-amber-700/70" />
              {/* 吹き出しのしっぽ（にちよさんの方を向く） */}
              <span
                aria-hidden
                className="absolute -bottom-[5px] left-4 h-2.5 w-2.5 rotate-45 border-b border-r border-amber-200 bg-white"
              />
            </Link>
          </motion.div>
        )}
      </div>

      <div className="consult-greeting w-full max-w-md rounded-card border border-amber-200 bg-white px-5 py-4 text-center shadow-card">
        <p className="text-lg font-bold leading-relaxed text-amber-900">{IDLE_LINE}</p>
        {showInbox && (
          <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
            教えてほしいことが{pendingCount}つあるき、手が空いたら上の「質問」を押してや。
          </p>
        )}
      </div>
    </section>
  );
}
