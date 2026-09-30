"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VendorHelpTurn = { role: "user" | "assistant"; text: string };

export type VendorHelpStatus = "idle" | "thinking" | "streaming" | "done" | "error";

/** サーバー（/api/vendor/help-chat）が受け取る、これまでのやりとりの上限と揃える */
const HISTORY_MAX = 10;
const HISTORY_TEXT_MAX = 2000;
const HISTORY_TOTAL_MAX = 6000;

const ERROR_LINE = "ごめんよ、うまく答えられんかった。もういっぺん聞いてみてや。";

/**
 * 直近のやりとりを、サーバーの上限に収まるよう新しい方から詰める。
 * 上限を超えると 400 になり、続けて聞けなくなるため。
 */
export function trimHistory(turns: VendorHelpTurn[]): VendorHelpTurn[] {
  const picked: VendorHelpTurn[] = [];
  let total = 0;
  for (let i = turns.length - 1; i >= 0 && picked.length < HISTORY_MAX; i -= 1) {
    const text = turns[i].text.slice(0, HISTORY_TEXT_MAX);
    if (total + text.length > HISTORY_TOTAL_MAX) break;
    total += text.length;
    picked.unshift({ role: turns[i].role, text });
  }
  return picked;
}

/**
 * 出店者トップで、にちよさんに使い方を相談する。
 *
 * 画面に出すのは最新の1問と答えだけ（ヘルプデスクとして「いまの困りごと」に集中させる）。
 * ただし続けて聞いたときに話がつながるよう、これまでのやりとりはサーバーへ渡す。
 */
export function useVendorHelpChat() {
  const [status, setStatus] = useState<VendorHelpStatus>("idle");
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const historyRef = useRef<VendorHelpTurn[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setQuestion(text);
    setAnswer("");
    setStatus("thinking");

    let received = "";
    try {
      const res = await fetch("/api/vendor/help-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ text, history: trimHistory(historyRef.current) }),
      });
      if (!res.ok || !res.body) {
        throw new Error(res.status === 429 ? "rate" : "upstream");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += decoder.decode(value, { stream: true });
        setAnswer(received);
        setStatus("streaming");
      }
      received += decoder.decode();
      if (!received.trim()) throw new Error("empty");

      setAnswer(received);
      setStatus("done");
      historyRef.current = [
        ...historyRef.current,
        { role: "user" as const, text },
        { role: "assistant" as const, text: received },
      ].slice(-HISTORY_MAX);
    } catch (err) {
      // 新しい質問に切り替えた・画面を離れたときの中断は、失敗として出さない
      if (ctrl.signal.aborted) return;
      setAnswer(
        err instanceof Error && err.message === "rate"
          ? "ちょっと続けて聞きすぎたみたい。少し休んでから、また聞いてや。"
          : received || ERROR_LINE
      );
      setStatus("error");
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, []);

  /** 答えを閉じて、いつものひとことに戻す（これまでのやりとりは覚えておく） */
  const close = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setQuestion(null);
    setAnswer("");
    setStatus("idle");
  }, []);

  return {
    status,
    question,
    answer,
    busy: status === "thinking" || status === "streaming",
    ask,
    close,
  };
}

/**
 * 「運営に問い合わせる」の行き先。運営が実際に見て返事をしている問い合わせフォームへ、
 * 相談した内容を入れた状態で渡す（フォームの本文は10〜1000文字）。
 */
export function contactHrefFor(question: string): string {
  const message = `【出店者ページのにちよさんへの相談から】\n${question}`.slice(0, 1000);
  const params = new URLSearchParams({ category: "question", message });
  return `/contact?${params.toString()}`;
}
