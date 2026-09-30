"use client";

import { motion, useReducedMotion } from "framer-motion";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import { Button, Surface } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { resolveGrandmaPose } from "@/lib/grandma/pose";
import AskInput from "./AskInputs";
import { useVendorAsk } from "./useVendorAsk";

/** 待っているあいだの、にちよさんの決まったひとこと */
const IDLE_LINE = "今日もおつかれさま！";
/** 聞きたいことがあるときに添えるひとこと */
const PENDING_LINE = "聞きたいことがあるき、手が空いたら「！」を押してや。";
/** 1回ぶん聞き終わったときのお礼 */
const DONE_LINE = "ありがとう！お客さんにもよう伝わるき。";

/**
 * 出店者ページの主役。
 *
 * 中央に大きなにちよさんが立ち、ふだんは吹き出しで決まったひとことを言っている。
 * 聞きたいことがあるときだけ、にちよさんの右上に「！」の吹き出しを出す（受信箱の
 * ような印で、たまっている質問の数も添える）。聞くことが無いときは出さない。
 * 出店者がそれを押したときだけ質問を始める（いきなり質問攻めにしない）。
 *
 * 質問は事前に運営が用意したもので（lib/vendor/askQuestions.ts）、1回に3つまで。
 * 出店者に「ここに書いた情報を読むのは来訪者だ」と感じてもらうため、
 * フォームではなく会話の形にしている。
 *
 * 話し手は既定のにちよさんに固定する。質問文がにちよさんの口調で書かれているため、
 * 相談ページで選んだ別のキャラに切り替えると言葉遣いが合わなくなる。
 */
export default function VendorAskStage({ vendorId }: { vendorId: string }) {
  const { status, snapshot, current, step, total, pendingCount, saving, error, start, stop, answer, skip } =
    useVendorAsk(vendorId);
  const reduceMotion = useReducedMotion() ?? false;

  const asking = status === "asking" && current !== null;
  const waiting = status === "idle" || status === "done";
  const showBadge = waiting && pendingCount > 0;

  const pose = resolveGrandmaPose({
    isListening: false,
    isStreaming: asking || status === "done",
    aiStatus: saving ? "thinking" : "idle",
  });

  return (
    <section aria-label="にちよさん" className="flex flex-col items-center gap-4">
      <div className="consult-appear relative flex">
        <GrandmaAvatar pose={pose} size="hero" character={DEFAULT_CONSULT_CHARACTER} />

        {showBadge && (
          <motion.button
            type="button"
            onClick={start}
            aria-label={`にちよさんの質問に答える（${pendingCount}つ）`}
            className="absolute right-0 top-1 flex h-12 w-12 translate-x-1/3 items-center justify-center rounded-full bg-amber-400 text-2xl font-black text-white shadow-lift ring-4 ring-white transition active:scale-95 motion-reduce:active:scale-100"
            initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
            animate={
              reduceMotion
                ? { scale: 1, opacity: 1 }
                : { scale: 1, opacity: 1, y: [0, -5, 0] }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    scale: { type: "spring", stiffness: 420, damping: 18 },
                    opacity: { duration: 0.15 },
                    y: { duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 },
                  }
            }
          >
            <span aria-hidden>！</span>
            {/* 受信箱のように、たまっている質問の数を添える */}
            <span
              aria-hidden
              data-testid="vendor-ask-badge-count"
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white"
            >
              {pendingCount}
            </span>
            {/* 吹き出しのしっぽ（にちよさんの方を向く） */}
            <span
              aria-hidden
              className="absolute -bottom-1 left-1 h-3.5 w-3.5 rotate-45 rounded-sm bg-amber-400"
            />
          </motion.button>
        )}
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
            うまく読めんかった。もういっぺん開いてみてや。
          </p>
        )}

        {waiting && (
          <>
            <p className="text-lg font-bold leading-relaxed text-amber-900">
              {status === "done" ? DONE_LINE : IDLE_LINE}
            </p>
            {showBadge && <p className="mt-1 text-sm leading-relaxed text-amber-900/80">{PENDING_LINE}</p>}
          </>
        )}

        {asking && (
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

      {asking && snapshot && (
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
          <button
            type="button"
            onClick={stop}
            disabled={saving}
            className="mt-3 w-full py-1 text-center text-xs font-semibold text-nicchyo-ink/55 disabled:opacity-50"
          >
            今は答えん（また「！」から聞いてね）
          </button>
        </Surface>
      )}
    </section>
  );
}
