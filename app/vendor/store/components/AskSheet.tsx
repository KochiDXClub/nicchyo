"use client";

import { useEffect, useState } from "react";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import AskInput from "@/components/vendor/ask/AskInputs";
import VendorSheet from "@/components/vendor/VendorSheet";
import { isClearable, type AskAnswer, type AskQuestion, type VendorAskSnapshot } from "@/lib/vendor/askQuestions";

/**
 * にちよさんが質問してくるシート。画面下から上がってきて、にちよさんが質問し、
 * 答えを入れるとその場で保存される。
 *
 * 出店者の下部ナビ（z-[9997]）とPCのサイドバー（z-[9999]）より手前に出して、
 * 入力欄の下がナビに隠れないようにする。
 */
export default function AskSheet({
  question,
  snapshot,
  saving,
  error,
  queueMode,
  onClose,
  onSubmit,
  onSkip,
  onClear,
}: {
  question: AskQuestion;
  snapshot: VendorAskSnapshot;
  saving: boolean;
  error: string | null;
  queueMode: boolean;
  onClose: () => void;
  onSubmit: (answer: AskAnswer) => void;
  /** 「続きを答える」の途中で、この質問だけ飛ばす */
  onSkip: () => void;
  /** 入れた値を消す */
  onClear: () => void;
}) {
  /** 「この答えを消す」を一度押したあと（誤って消さないよう、もう一度確かめる） */
  const [confirmingClear, setConfirmingClear] = useState(false);
  useEffect(() => setConfirmingClear(false), [question.id]);

  return (
    // 開いたら中へ、次の質問に進んだら新しい入力欄へフォーカスを移し、閉じたら元の行へ戻す
    <VendorSheet label={question.text} focusKey={question.id} busy={saving} onClose={onClose}>
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
          {(queueMode || (isClearable(question.id) && question.isAnswered(snapshot))) && (
            <div className="mt-3 flex items-center justify-center gap-4 text-sm">
              {queueMode && (
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={saving}
                  className="font-semibold text-nicchyo-ink/60 underline underline-offset-2 disabled:opacity-50"
                >
                  この質問は飛ばす
                </button>
              )}
              {isClearable(question.id) &&
                question.isAnswered(snapshot) &&
                (confirmingClear ? (
                  <span className="flex items-center gap-3" role="group" aria-label="この答えを消してよいか">
                    <span className="font-semibold text-nicchyo-ink/70">ほんまに消す？</span>
                    <button
                      type="button"
                      onClick={onClear}
                      disabled={saving}
                      className="font-bold text-rose-600 underline underline-offset-2 disabled:opacity-50"
                    >
                      消す
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingClear(false)}
                      disabled={saving}
                      className="font-semibold text-nicchyo-ink/60 underline underline-offset-2 disabled:opacity-50"
                    >
                      やめる
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(true)}
                    disabled={saving}
                    className="font-semibold text-rose-600 underline underline-offset-2 disabled:opacity-50"
                  >
                    この答えを消す
                  </button>
                ))}
            </div>
          )}
          {error && (
            <p className="mt-3 text-sm text-rose-600" role="alert">
              {error}
            </p>
          )}
        </div>
    </VendorSheet>
  );
}
