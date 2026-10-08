"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
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
  // 絵が答えそのものになる質問だけ、本物の写真を出す（飾りの絵は置かない）
  const thumbnail =
    answered && question.id === "shop-photo"
      ? snapshot.shopImageUrl
      : answered && question.id === "signature"
        ? snapshot.signatureProduct?.imageUrl
        : undefined;

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.03, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3.5 text-left transition duration-200 ease-out-soft",
          "active:bg-amber-50",
          answered ? "hover:bg-nicchyo-base/60" : "bg-amber-50/60 hover:bg-amber-50"
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold leading-snug text-nicchyo-ink/70">{question.text}</span>
          {answered && summary ? (
            <span className="mt-1 line-clamp-2 block text-base font-semibold leading-snug text-nicchyo-ink">
              {summary}
            </span>
          ) : (
            <span className="mt-1 block text-base font-semibold text-amber-700">答えてや</span>
          )}
        </span>
        {thumbnail && (
          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-btn bg-amber-50">
            <Image src={thumbnail} alt="" fill sizes="2.75rem" className="object-cover" />
          </span>
        )}
        <ChevronRight
          size={18}
          className={cn("shrink-0", answered ? "text-nicchyo-ink/40" : "text-amber-500")}
          aria-hidden="true"
        />
      </button>
    </motion.li>
  );
}
