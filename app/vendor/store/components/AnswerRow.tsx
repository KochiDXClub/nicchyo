"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { AskQuestion, VendorAskSnapshot } from "@/lib/vendor/askQuestions";

/** 質問と、その答え。タップすると、にちよさんが質問してくる */
export default function AnswerRow({
  question,
  snapshot,
  index,
  onOpen,
}: {
  question: AskQuestion;
  snapshot: VendorAskSnapshot;
  index: number;
  onOpen: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const answered = question.isAnswered(snapshot);
  const summary = question.summary(snapshot);

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-center gap-3.5 rounded-card px-4 py-3.5 text-left transition duration-200 ease-out-soft",
          "active:scale-[0.99] motion-reduce:active:scale-100",
          answered
            ? "bg-white shadow-card ring-1 ring-line hover:shadow-lift"
            : "bg-white/70 ring-2 ring-dashed ring-amber-300 hover:bg-white"
        )}
      >
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl",
            answered ? "bg-amber-50" : "bg-amber-100"
          )}
          aria-hidden="true"
        >
          {question.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold leading-snug text-amber-800">{question.text}</span>
          {answered && summary ? (
            <span className="mt-1 line-clamp-2 block text-[15px] font-semibold leading-snug text-nicchyo-ink">
              {summary}
            </span>
          ) : (
            <span className="mt-1 block text-[15px] font-semibold text-amber-700">
              タップして答えてや
            </span>
          )}
        </span>
        {answered ? (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white"
            aria-label="答え済み"
          >
            <Check size={14} aria-hidden="true" />
          </span>
        ) : (
          <ChevronRight size={20} className="shrink-0 text-amber-500" aria-hidden="true" />
        )}
      </button>
    </motion.li>
  );
}
