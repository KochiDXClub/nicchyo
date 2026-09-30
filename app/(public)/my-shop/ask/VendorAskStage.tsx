"use client";

import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import { Button, Surface } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { resolveGrandmaPose } from "@/lib/grandma/pose";
import AskInput from "./AskInputs";
import { useVendorAsk } from "./useVendorAsk";

/**
 * 出店者ページの主役。
 *
 * 中央に大きなにちよさんが立ち、吹き出しで質問してくる。答えは下の入力欄に入れる。
 * 質問は事前に運営が用意したもので（lib/vendor/askQuestions.ts）、1回に3つまで。
 * 出店者に「ここに書いた情報を読むのは来訪者だ」と感じてもらうため、
 * フォームではなく会話の形にしている。
 *
 * 話し手は既定のにちよさんに固定する。質問文がにちよさんの口調で書かれているため、
 * 相談ページで選んだ別のキャラに切り替えると言葉遣いが合わなくなる。
 */
export default function VendorAskStage({ vendorId }: { vendorId: string }) {
  const { status, snapshot, current, step, total, startedEmpty, saving, error, answer, skip } =
    useVendorAsk(vendorId);

  const pose = resolveGrandmaPose({
    isListening: false,
    isStreaming: status === "done",
    aiStatus: saving ? "thinking" : "idle",
  });

  return (
    <section aria-label="にちよさんの質問" className="flex flex-col items-center gap-4">
      <div className="consult-appear flex">
        <GrandmaAvatar pose={pose} size="hero" character={DEFAULT_CONSULT_CHARACTER} />
      </div>

      <div
        className="consult-greeting w-full max-w-md rounded-card border border-amber-200 bg-white px-5 py-4 text-center shadow-card"
        aria-live="polite"
      >
        {status === "loading" && (
          <div className="flex flex-col items-center gap-2" aria-label="読み込み中">
            <span className="consult-skeleton h-3.5 w-4/5 rounded-full" />
            <span className="consult-skeleton h-3.5 w-3/5 rounded-full" style={{ animationDelay: "120ms" }} />
          </div>
        )}

        {status === "error" && (
          <p className="text-lg font-bold leading-relaxed text-amber-900">
            うまく聞けんかった。もういっぺん開いてみてや。
          </p>
        )}

        {status === "done" && (
          <p className="text-lg font-bold leading-relaxed text-amber-900">
            {startedEmpty
              ? "今日は聞くことないき、ゆっくりしいや。"
              : "ありがとう！お客さんにもよう伝わるき。"}
          </p>
        )}

        {status === "asking" && current && (
          <>
            {total > 1 && (
              <div
                className="mb-2 flex items-center justify-center gap-1.5"
                role="img"
                aria-label={`${total}つのうち${step + 1}つめ`}
              >
                {Array.from({ length: total }, (_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-1.5 w-6 rounded-full",
                      index <= step ? "bg-amber-500" : "bg-amber-100"
                    )}
                  />
                ))}
              </div>
            )}
            <p className="text-lg font-bold leading-relaxed text-amber-900">{current.text}</p>
          </>
        )}
      </div>

      {status === "error" && (
        <Button variant="secondary" onClick={() => window.location.reload()}>
          もういっぺん
        </Button>
      )}

      {status === "asking" && current && snapshot && (
        <Surface elevation="lifted" className="w-full max-w-md">
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
    </section>
  );
}
