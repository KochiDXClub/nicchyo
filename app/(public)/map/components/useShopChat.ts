"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readTextStream } from "@/lib/ai/readTextStream";
import type { ShopChatCharacterView } from "@/lib/grandma/shopChat/character";
import { SHOP_CHAT_MAX_HISTORY } from "@/lib/grandma/shopChat/request";

export type ChatMsg = { role: "user" | "assistant"; text: string };

const ERROR_TEXT = "うまく答えられませんでした。もう一度試してみてください。";

/**
 * お店ごとの相談の会話。
 * 送るのは shopId・質問・これまでのやりとりだけ（お店の情報はサーバーが読む）。
 */
export function useShopChat(shopId: number) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streaming, setStreaming] = useState(false);
  /** 直近の回答を識別する ID と、そのときの質問。評価を送るときに使う */
  const [lastConsultId, setLastConsultId] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
    setLastConsultId(null);
    setLastQuestion("");
  }, []);

  // お店が変わったら、前のお店との会話は捨てる
  useEffect(() => {
    reset();
  }, [shopId, reset]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const history = messages.slice(-SHOP_CHAT_MAX_HISTORY);
      setMessages((prev) => [...prev, { role: "user", text: trimmed }, { role: "assistant", text: "" }]);
      setStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch("/api/grandma/shop-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({ shopId, history, text: trimmed }),
        });
        if (!res.ok || !res.body) throw new Error("upstream error");

        setLastConsultId(res.headers.get("X-Consult-Id") ?? null);
        setLastQuestion(trimmed);

        await readTextStream(res.body, (chunk) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") copy[copy.length - 1] = { ...last, text: last.text + chunk };
            return copy;
          });
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant" && !last.text) copy[copy.length - 1] = { ...last, text: ERROR_TEXT };
            return copy;
          });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, shopId, streaming]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  return { messages, streaming, lastConsultId, lastQuestion, send, abort, reset };
}

/**
 * このお店の相談で話すキャラ。取れるまで（取れなかったとき）は null のまま。
 * 取れなかったときは呼び出し側が既定のキャラで出す。
 */
export function useShopChatCharacter(shopId: number): { character: ShopChatCharacterView | null; settled: boolean } {
  const [state, setState] = useState<{ shopId: number; character: ShopChatCharacterView | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/grandma/shop-chat/character?shopId=${shopId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { character?: ShopChatCharacterView } | null) => {
        if (!cancelled) setState({ shopId, character: json?.character ?? null });
      })
      .catch(() => {
        if (!cancelled) setState({ shopId, character: null });
      });
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const settled = state?.shopId === shopId;
  return { character: settled ? state.character : null, settled };
}
