"use client";

import { forwardRef, useState } from "react";
import { Send } from "lucide-react";
import { isImeComposing } from "@/lib/utils/isImeComposing";

/**
 * にちよさんの下の入力欄。相談ページ（ConsultStage）の文字入力と同じ形にそろえる。
 * 最初から入力欄を出しておき、Enter（日本語の変換確定は除く）か送信ボタンで聞く。
 */
const VendorHelpInput = forwardRef<
  HTMLInputElement,
  {
    busy: boolean;
    onAsk: (text: string) => void;
  }
>(function VendorHelpInput({ busy, onAsk }, ref) {
  const [typed, setTyped] = useState("");

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setTyped("");
    onAsk(text);
  };

  return (
    <div className="flex w-full max-w-md items-center gap-2 rounded-chip border border-amber-200 bg-white/95 py-1.5 pl-5 pr-1.5 shadow-card focus-within:ring-2 focus-within:ring-amber-400">
      <input
        ref={ref}
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
        // 答えを待つあいだも disabled にはしない。disabled にするとフォーカスが外れ、
        // 続けて聞くたびに入力欄まで戻らないといけなくなる（送信は send で止める）
        readOnly={busy}
        aria-disabled={busy}
        className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-nicchyo-ink outline-none placeholder:text-nicchyo-ink/40 read-only:opacity-50"
      />
      <button
        type="button"
        disabled={busy || !typed.trim()}
        onClick={() => send(typed)}
        aria-label="聞く"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-pop transition disabled:opacity-40"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
});

export default VendorHelpInput;
