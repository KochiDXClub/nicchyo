"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import HelpAnswerText from "@/app/(public)/my-shop/help/HelpAnswerText";
import { Surface } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { useTryAsk, type TryAskMode } from "../useTryAsk";

const MODES: { mode: TryAskMode; label: string; placeholder: string; note: string }[] = [
  {
    mode: "visitor",
    label: "お客さんとして",
    placeholder: "例：何時ごろが空いてる？",
    note: "お店のページのチャットと同じにちよさんが答えます",
  },
  {
    mode: "vendor",
    label: "自分として",
    placeholder: "例：土曜の仕入れのこと、覚えちゅう？",
    note: "使い方相談と同じにちよさんが答えます",
  },
];

/**
 * 試しに聞いてみる。書いたノートを、にちよさんが本当に使って答えるかをその場で確かめる。
 * お客さん役と自分役を切り替えて、どちらのにちよさんの答えも見られる。
 */
export default function TryAsk({ vendorId }: { vendorId: string }) {
  const [mode, setMode] = useState<TryAskMode>("visitor");
  const [question, setQuestion] = useState("");
  const tryAsk = useTryAsk(vendorId);
  const current = MODES.find((item) => item.mode === mode) ?? MODES[0];

  function switchMode(next: TryAskMode) {
    if (next === mode) return;
    setMode(next);
    tryAsk.reset();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (tryAsk.busy) return;
    void tryAsk.ask(mode, question);
  }

  return (
    <Surface>
      <h2 className="text-base font-bold text-nicchyo-ink">試しに聞いてみる</h2>
      <p className="mt-1 text-sm text-nicchyo-ink/70">書いたノートで、にちよさんがどう答えるか確かめられます。</p>

      <div className="mt-3 grid grid-cols-2 gap-1 rounded-chip bg-nicchyo-ink/[0.06] p-1" role="group" aria-label="誰として聞くか">
        {MODES.map((item) => (
          <button
            key={item.mode}
            type="button"
            aria-pressed={mode === item.mode}
            onClick={() => switchMode(item.mode)}
            className={cn(
              "h-10 rounded-chip text-sm font-semibold transition",
              mode === item.mode ? "bg-white text-nicchyo-ink shadow-chip" : "text-nicchyo-ink/60"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-nicchyo-ink/55">{current.note}</p>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <label htmlFor="try-ask-input" className="sr-only">
          にちよさんに聞くこと
        </label>
        <input
          id="try-ask-input"
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={200}
          placeholder={current.placeholder}
          className="min-w-0 flex-1 rounded-btn bg-white px-4 py-3 text-base text-nicchyo-ink outline-none ring-1 ring-line placeholder:text-nicchyo-ink/40 focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="submit"
          disabled={tryAsk.busy || !question.trim()}
          aria-label="聞く"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-chip bg-amber-600 text-white shadow-sm transition hover:bg-amber-500 disabled:opacity-45"
        >
          {tryAsk.busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
        </button>
      </form>

      {tryAsk.status !== "idle" && (
        <div className="mt-4 flex items-start gap-3" aria-live="polite" aria-busy={tryAsk.busy}>
          <GrandmaAvatar
            pose={tryAsk.busy ? "thinking" : "speaking"}
            size="pinned"
            character={DEFAULT_CONSULT_CHARACTER}
            className="shrink-0"
          />
          <div className="consult-greeting consult-greeting--left min-w-0 flex-1 rounded-card border border-amber-200 bg-amber-50/60 px-4 py-3">
            {tryAsk.status === "thinking" ? (
              <p className="text-base text-amber-900">考えよります…</p>
            ) : mode === "vendor" ? (
              // 自分の相談のにちよさんは、画面への案内をリンクで返すことがある
              <HelpAnswerText answer={tryAsk.answer} />
            ) : (
              <p className="whitespace-pre-wrap text-base leading-relaxed text-amber-900">{tryAsk.answer}</p>
            )}
          </div>
        </div>
      )}
    </Surface>
  );
}
