"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { isImeComposing } from "@/lib/utils/isImeComposing";

/** 何を聞けばいいか迷わないよう、よくある困りごとを置いておく */
export const VENDOR_HELP_SUGGESTIONS = [
  "お店の写真を変えたい",
  "出店する日を変えるには？",
  "今週のお店の様子は？",
] as const;

/**
 * にちよさんの下の入力欄。相談ページ（ConsultStage）の文字入力と同じ形にそろえる。
 * 最初から入力欄を出しておき、Enter（日本語の変換確定は除く）か送信ボタンで聞く。
 */
export default function VendorHelpInput({
  busy,
  showSuggestions,
  onAsk,
}: {
  busy: boolean;
  /** まだ何も聞いていないときだけ、よくある困りごとを出す */
  showSuggestions: boolean;
  onAsk: (text: string) => void;
}) {
  const [typed, setTyped] = useState("");

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setTyped("");
    onAsk(text);
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <div className="flex items-center gap-2 rounded-chip border border-amber-200 bg-white/95 py-1.5 pl-5 pr-1.5 shadow-lift">
        <input
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            // 日本語入力の変換確定の Enter で、未確定テキストのまま送信してしまわないようにする
            if (isImeComposing(event)) return;
            if (event.key !== "Enter") return;
            event.preventDefault();
            send(typed);
          }}
          placeholder="（例）商品の写真の入れ方は？"
          aria-label="にちよさんに相談する"
          enterKeyHint="send"
          maxLength={1000}
          disabled={busy}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-nicchyo-ink outline-none placeholder:text-nicchyo-ink/40 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={busy || !typed.trim()}
          onClick={() => send(typed)}
          aria-label="聞く"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm transition disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {showSuggestions && (
        <div className="flex flex-wrap justify-center gap-2">
          {VENDOR_HELP_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={busy}
              onClick={() => send(suggestion)}
              className="rounded-chip border border-amber-200 bg-white/80 px-3 py-1.5 text-sm font-bold text-amber-900 transition active:scale-95 disabled:opacity-50 motion-reduce:active:scale-100"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-xs leading-relaxed text-nicchyo-ink/55">
        相談の内容とにちよさんの答えは、案内を良くするために運営が保存します。
      </p>
    </div>
  );
}
