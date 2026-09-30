"use client";

import Link from "next/link";
import { X } from "lucide-react";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import { Button, Surface, buttonClass } from "@/components/ui";
import { resolveGrandmaPose } from "@/lib/grandma/pose";
import AskInput from "./AskInputs";
import { useVendorAsk } from "./useVendorAsk";

/** 聞き終わったときのひとこと */
function doneLine(answeredCount: number, skippedCount: number): string {
  if (answeredCount === 0 && skippedCount === 0) return "今は聞くことないき、ゆっくりしいや。";
  if (skippedCount > 0) return "ありがとう！あとにしたのは、また今度聞かせてや。";
  return "ぜんぶ教えてくれて、ありがとう！お客さんにもよう伝わるき。";
}

/**
 * 質問ページ（/my-shop/ask）の中身。にちよさんと質問だけを出す。
 *
 * 出店者トップの吹き出し（「！」）から来る。上の「×」でいつでも出店者トップへ戻れる
 * （ブラウザの戻るでも同じ）。答えた分はその場で保存しているので、途中でやめても消えない。
 */
export default function VendorAskSession({ vendorId }: { vendorId: string }) {
  const { status, snapshot, current, remaining, answeredCount, skippedCount, saving, error, answer, skip } =
    useVendorAsk(vendorId);

  const pose = resolveGrandmaPose({
    isListening: false,
    isStreaming: status === "asking" || status === "done",
    aiStatus: saving ? "thinking" : "idle",
  });

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[var(--consult-bg)]" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center gap-4 px-5 pb-10">
        <header
          className="flex w-full items-center justify-between"
          style={{ paddingTop: "calc(0.75rem + var(--safe-top, 0px))" }}
        >
          <Link
            href="/my-shop"
            aria-label="質問をやめて戻る"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-nicchyo-ink shadow-card ring-1 ring-line transition active:scale-95 motion-reduce:active:scale-100"
          >
            <X className="h-5 w-5" aria-hidden />
          </Link>
          {status === "asking" && (
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-200">
              のこり {remaining}つ
            </span>
          )}
        </header>

        <div className="consult-appear flex">
          <GrandmaAvatar pose={pose} size="hero" character={DEFAULT_CONSULT_CHARACTER} />
        </div>

        <div
          className="consult-greeting w-full rounded-card border border-amber-200 bg-white px-5 py-4 text-center shadow-card"
          aria-live="polite"
        >
          {status === "loading" && (
            <div className="flex flex-col items-center gap-2" aria-label="読み込み中">
              <span className="consult-skeleton h-3.5 w-4/5 rounded-full" />
              <span className="consult-skeleton h-3.5 w-3/5 rounded-full" style={{ animationDelay: "120ms" }} />
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
          <Link href="/my-shop" className={buttonClass({ variant: "secondary", className: "w-full" })}>
            もどる
          </Link>
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
