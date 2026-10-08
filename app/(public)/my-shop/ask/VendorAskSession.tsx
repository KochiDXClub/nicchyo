"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import { Button, Surface, buttonClass } from "@/components/ui";
import { resolveGrandmaPose } from "@/lib/grandma/pose";
import { cn } from "@/lib/utils/cn";
import type { AskQuestion, AskQuestionId } from "@/lib/vendor/askQuestions";
import AskInput from "@/components/vendor/ask/AskInputs";
import VendorBackdrop from "@/components/vendor/VendorBackdrop";
import { useVendorAsk } from "./useVendorAsk";
import { countLabel } from "./countLabel";

/** 聞き終わったときのひとこと */
function doneLine(answeredCount: number, skippedCount: number): string {
  if (answeredCount === 0 && skippedCount === 0) return "今は聞くことないき、ゆっくりしいや。";
  if (skippedCount > 0) return "ありがとう！あとにしたのは、また今度聞かせてや。";
  return "ぜんぶ教えてくれて、ありがとう！お客さんにもよう伝わるき。";
}

/**
 * 「のこり ◯つ」を押すと開く、これから聞く質問の一覧。
 * 質問を押すと、その質問へ飛ぶ（「あとで」にした質問も選べばまた聞く）。
 * 聞き終わった画面でも、「あとで」にした質問が残っていれば出す。
 */
function QuestionList({
  questions,
  currentId,
  skippedIds,
  onSelect,
}: {
  questions: AskQuestion[];
  currentId: AskQuestionId | null;
  skippedIds: AskQuestionId[];
  onSelect: (id: AskQuestionId) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // 外側を押すか Esc で閉じる。開いているあいだだけ登録する
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // 一覧の中にいたフォーカスが、一覧ごと消えて迷子にならないよう開くボタンへ戻す
      toggleRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef}>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={listId}
        className="flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-card ring-1 ring-amber-200 transition active:scale-95 motion-reduce:active:scale-100"
      >
        のこり {countLabel(questions.length)}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          id={listId}
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-card bg-white shadow-float ring-1 ring-amber-200"
        >
          <p className="px-4 pb-1 pt-3 text-xs font-bold text-nicchyo-ink/55">これから聞くこと（押すとその質問へ）</p>
          <ol className="max-h-[50vh] overflow-y-auto overscroll-contain p-2">
            {questions.map((question, index) => {
              const isCurrent = question.id === currentId;
              const isSkipped = skippedIds.includes(question.id);
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(question.id);
                      setOpen(false);
                    }}
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-btn px-3 py-2.5 text-left transition",
                      isCurrent ? "bg-amber-50" : "active:bg-amber-50/60"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                        isCurrent ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-900"
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-sm leading-snug text-nicchyo-ink">{question.text}</span>
                    {isCurrent && (
                      <span className="shrink-0 rounded-chip bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                        いま
                      </span>
                    )}
                    {isSkipped && !isCurrent && (
                      <span className="shrink-0 rounded-chip bg-nicchyo-ink/5 px-2 py-0.5 text-[11px] font-bold text-nicchyo-ink/55">
                        あとで
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

/**
 * 質問ページ（/my-shop/ask）の中身。にちよさんと質問だけを出す。
 *
 * 出店者トップの吹き出し（「！」）から来る。上の「×」でいつでも出店者トップへ戻れる
 * （ブラウザの戻るでも同じ）。答えた分はその場で保存しているので、途中でやめても消えない。
 */
export default function VendorAskSession({ vendorId }: { vendorId: string }) {
  const {
    status,
    snapshot,
    current,
    unanswered,
    skippedIds,
    answeredCount,
    skippedCount,
    saving,
    error,
    answer,
    skip,
    jumpTo,
  } = useVendorAsk(vendorId);

  const pose = resolveGrandmaPose({
    isListening: false,
    isStreaming: status === "asking" || status === "done",
    aiStatus: saving ? "thinking" : "idle",
  });

  // 次の質問に進んだら、質問の吹き出しへフォーカスを移す。押したボタンや一覧が消えて
  // フォーカスが迷子になるのを防ぎ、読み上げでも新しい質問から読めるようにする（最初の表示は除く）
  const questionRef = useRef<HTMLDivElement>(null);
  const shownIdRef = useRef<AskQuestionId | null>(null);
  const currentId = current?.id ?? null;
  useEffect(() => {
    const previous = shownIdRef.current;
    shownIdRef.current = currentId;
    if (previous !== null && previous !== currentId) questionRef.current?.focus();
  }, [currentId]);

  return (
    <div className="relative min-h-screen">
      <VendorBackdrop />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center gap-4 px-5 pb-10">
        <h1 className="sr-only">にちよさんからの質問</h1>
        <header
          className="relative flex w-full items-center justify-between"
          style={{ paddingTop: "calc(0.75rem + var(--safe-top, 0px))" }}
        >
          <Link
            href="/my-shop"
            aria-label="質問をやめて戻る"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-nicchyo-ink shadow-card ring-1 ring-line transition active:scale-95 motion-reduce:active:scale-100"
          >
            <X className="h-5 w-5" aria-hidden />
          </Link>
          {unanswered.length > 0 && (status === "asking" || status === "done") && (
            <QuestionList
              questions={unanswered}
              currentId={current?.id ?? null}
              skippedIds={skippedIds}
              onSelect={jumpTo}
            />
          )}
        </header>

        <div className="consult-appear flex">
          <GrandmaAvatar pose={pose} size="hero" character={DEFAULT_CONSULT_CHARACTER} />
        </div>

        <div
          ref={questionRef}
          tabIndex={-1}
          className="consult-greeting w-full rounded-card border border-amber-200 bg-white px-5 py-4 text-center shadow-card outline-none"
          aria-live="polite"
        >
          {status === "loading" && (
            <div className="flex flex-col items-center gap-2">
              <span className="sr-only">読み込み中</span>
              <span aria-hidden className="consult-skeleton h-3.5 w-4/5 rounded-full" />
              <span aria-hidden className="consult-skeleton h-3.5 w-3/5 rounded-full" style={{ animationDelay: "120ms" }} />
            </div>
          )}
          {status === "error" && (
            <p className="text-lg font-bold leading-relaxed text-amber-900">うまく読めんかった。もういっぺん開いてみてや。</p>
          )}
          {status === "done" && (
            <p className="text-lg font-bold leading-relaxed text-amber-900">{doneLine(answeredCount, skippedCount)}</p>
          )}
          {status === "asking" && current && (
            <p className="text-lg font-bold leading-relaxed text-amber-900">{current.text}</p>
          )}
        </div>

        {status === "error" && (
          <Button variant="secondary" onClick={() => window.location.reload()}>
            もういっぺん
          </Button>
        )}

        {status === "done" && (
          <div className="flex w-full flex-col gap-2">
            {/* 「あとで」にした質問がまだあるなら、この回のうちに答えられるようにする */}
            {unanswered.length > 0 && (
              <Button className="w-full" onClick={() => jumpTo(unanswered[0].id)}>
                あとにした質問に答える
              </Button>
            )}
            <Link href="/my-shop" className={buttonClass({ variant: "secondary", className: "w-full" })}>
              もどる
            </Link>
          </div>
        )}

        {status === "asking" && current && snapshot && (
          <Surface elevation="lifted" className="w-full">
            <AskInput
              key={current.id}
              question={current}
              snapshot={snapshot}
              saving={saving}
              onSubmit={(value) => void answer(value)}
              onSkip={skip}
            />
            {error && (
              <p className="mt-3 text-sm text-rose-600" role="alert">
                {error}
              </p>
            )}
          </Surface>
        )}
      </div>
    </div>
  );
}
