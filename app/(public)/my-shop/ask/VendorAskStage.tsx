"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { MessageCircleQuestionMark, X } from "lucide-react";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import { resolveGrandmaPose } from "@/lib/grandma/pose";
import { useVendorAskInbox } from "./useVendorAsk";
import VendorHelpInput from "../help/VendorHelpInput";
import { contactHrefFor, useVendorHelpChat } from "../help/useVendorHelpChat";

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
  const help = useVendorHelpChat();

  const pose = resolveGrandmaPose({
    isListening: false,
    isStreaming: help.status === "streaming",
    aiStatus: help.status === "thinking" ? "thinking" : "idle",
  });

  return (
    <section aria-label="にちよさん" className="flex flex-col items-center gap-4">
      <div className="consult-appear relative flex">
        <GrandmaAvatar pose={pose} size="hero" character={DEFAULT_CONSULT_CHARACTER} />

        {showInbox && (
          <motion.div
            className="absolute right-0 top-2 translate-x-1/4"
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
              className="relative flex items-center gap-1.5 rounded-full bg-white py-1.5 pl-1.5 pr-3 shadow-lift ring-1 ring-amber-200 transition active:scale-95 motion-reduce:active:scale-100"
            >
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-base font-black leading-none text-white"
              >
                !
              </span>
              <span
                aria-hidden
                data-testid="vendor-ask-inbox-count"
                className="text-base font-bold tabular-nums leading-none text-amber-900"
              >
                {pendingCount}
              </span>
              {/* 吹き出しのしっぽ（にちよさんの方を向く） */}
              <span
                aria-hidden
                className="absolute -bottom-[5px] left-4 h-2.5 w-2.5 rotate-45 border-b border-r border-amber-200 bg-white"
              />
            </Link>
          </motion.div>
        )}
      </div>

      <div
        className="consult-greeting w-full max-w-md rounded-card border border-amber-200 bg-white px-5 py-4 shadow-card"
        aria-live="polite"
      >
        {help.question ? (
          <HelpAnswer
            question={help.question}
            answer={help.answer}
            status={help.status}
            onClose={help.close}
          />
        ) : (
          <div className="text-center">
            <p className="text-lg font-bold leading-relaxed text-amber-900">{IDLE_LINE}</p>
            {showInbox ? (
              <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
                教えてほしいことが{pendingCount}つあるき、手が空いたら上の吹き出しを押してや。
              </p>
            ) : (
              <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
                使い方で困ったら、下から聞いてや。
              </p>
            )}
          </div>
        )}
      </div>

      <VendorHelpInput busy={help.busy} onAsk={(text) => void help.ask(text)} />
    </section>
  );
}

/** 吹き出しの中身：聞いたことと、にちよさんの答え */
function HelpAnswer({
  question,
  answer,
  status,
  onClose,
}: {
  question: string;
  answer: string;
  status: ReturnType<typeof useVendorHelpChat>["status"];
  onClose: () => void;
}) {
  const finished = status === "done" || status === "error";

  return (
    <div>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-nicchyo-ink/70">
          <span className="sr-only">あなたの相談：</span>
          「{question}」
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="相談を閉じる"
          className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-nicchyo-ink/55 transition active:scale-95 motion-reduce:active:scale-100"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {status === "thinking" ? (
        <div className="mt-3 flex flex-col gap-2" aria-label="にちよさんが考えています">
          <span className="consult-skeleton h-3.5 w-4/5 rounded-full" />
          <span className="consult-skeleton h-3.5 w-3/5 rounded-full" style={{ animationDelay: "120ms" }} />
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-amber-900">{answer}</p>
      )}

      {/* にちよさんで解決しないときの逃げ道。答えを読み終えてから出す */}
      {finished && (
        <Link
          href={contactHrefFor(question)}
          className="mt-4 flex items-center justify-center gap-1.5 rounded-chip border border-amber-200 px-4 py-2.5 text-sm font-bold text-amber-900 transition active:scale-95 motion-reduce:active:scale-100"
        >
          <MessageCircleQuestionMark className="h-4 w-4 shrink-0" aria-hidden />
          解決しないときは運営に問い合わせる
        </Link>
      )}
    </div>
  );
}
