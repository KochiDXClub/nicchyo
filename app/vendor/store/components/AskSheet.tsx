"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import AskInput from "@/components/vendor/ask/AskInputs";
import { useBodyScrollLock } from "@/lib/ui/bodyScrollLock";
import type { AskAnswer, AskQuestion, VendorAskSnapshot } from "@/lib/vendor/askQuestions";

/**
 * にちよさんが質問してくるシート。画面下から上がってきて、にちよさんが質問し、
 * 答えを入れるとその場で保存される。
 *
 * 下部ナビ（z-[1002]）より手前に出して、入力欄の下がナビに隠れないようにする。
 */
export default function AskSheet({
  question,
  snapshot,
  saving,
  error,
  queueMode,
  onClose,
  onSubmit,
}: {
  question: AskQuestion;
  snapshot: VendorAskSnapshot;
  saving: boolean;
  error: string | null;
  queueMode: boolean;
  onClose: () => void;
  onSubmit: (answer: AskAnswer) => void;
}) {
  const reduceMotion = useReducedMotion();
  useBodyScrollLock(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  return (
    <motion.div
      className="fixed inset-0 z-[1100] flex items-end justify-center"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.18 } }}
    >
      <button
        type="button"
        aria-label="閉じる"
        onClick={() => !saving && onClose()}
        className="absolute inset-0 bg-nicchyo-ink/40 backdrop-blur-[2px]"
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label={question.text}
        className="relative max-h-[90dvh] w-full max-w-[38rem] overflow-y-auto overscroll-contain rounded-t-sheet bg-nicchyo-base shadow-float"
        style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 1.5rem)" }}
        initial={reduceMotion ? false : { y: "100%" }}
        animate={{ y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-nicchyo-ink/15" aria-hidden="true" />

        <div className="flex items-start gap-3 px-5 pt-4">
          <GrandmaAvatar
            pose={saving ? "thinking" : "idle"}
            size="pinned"
            character={DEFAULT_CONSULT_CHARACTER}
            className="shrink-0"
          />
          <div className="consult-greeting consult-greeting--left min-w-0 flex-1 rounded-card border border-amber-200 bg-white px-4 py-3 shadow-card">
            <p className="text-base font-bold leading-relaxed text-amber-900">
              <span aria-hidden="true">{question.emoji} </span>
              {question.text}
            </p>
          </div>
        </div>

        <div className="px-5 pt-5">
          <AskInput
            key={question.id}
            question={question}
            snapshot={snapshot}
            saving={saving}
            onSubmit={onSubmit}
            onSkip={onClose}
            skipLabel={queueMode ? "ここまでにする" : "閉じる"}
          />
          {error && (
            <p className="mt-3 text-sm text-rose-600" role="alert">
              {error}
            </p>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}
