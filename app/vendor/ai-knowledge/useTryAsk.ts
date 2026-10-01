"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { readTextStream } from "@/lib/ai/readTextStream";

/** 誰として聞くか。visitor = お客さんのにちよさん、vendor = 自分の相談のにちよさん */
export type TryAskMode = "visitor" | "vendor";
export type TryAskStatus = "idle" | "thinking" | "streaming" | "done" | "error";

const FAILURE_TEXT: Record<"rate" | "other", string> = {
  rate: "ちょっと聞きすぎたみたい。少し待ってから、もういっぺん聞いてや。",
  other: "うまく答えられんかった。もういっぺん聞いてみてや。",
};

/**
 * ノートを書いたあと、にちよさんが本当にそれを使って答えるかを試す。
 * お客さん役ではお店のページのチャット（/api/grandma/shop-chat）に、
 * 自分役では使い方相談（/api/vendor/help-chat）に、そのまま聞く。
 * 1回ずつの問いかけで、前のやりとりは渡さない（書いたノートの効き目だけを見るため）。
 */
export function useTryAsk(vendorId: string | null) {
  const [status, setStatus] = useState<TryAskStatus>("idle");
  const [answer, setAnswer] = useState("");
  const [shopName, setShopName] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // お客さん役で聞くときは、店名をにちよさんに渡す（お店のページのチャットと同じ形）
  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    createClient()
      .from("vendors")
      .select("shop_name")
      .eq("id", vendorId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setShopName(data?.shop_name ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const ask = useCallback(
    async (mode: TryAskMode, raw: string) => {
      const text = raw.trim();
      if (!text || !vendorId) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setAnswer("");
      setStatus("thinking");

      let received = "";
      try {
        const res =
          mode === "visitor"
            ? await fetch("/api/grandma/shop-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: ctrl.signal,
                body: JSON.stringify({
                  shopName: shopName ?? "このお店",
                  shopContext: {},
                  vendorId,
                  history: [],
                  text,
                }),
              })
            : await fetch("/api/vendor/help-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: ctrl.signal,
                body: JSON.stringify({ text, history: [] }),
              });
        if (!res.ok || !res.body) throw new Error(res.status === 429 ? "rate" : "other");

        received = await readTextStream(res.body, (soFar) => {
          received = soFar;
          setAnswer(soFar);
          setStatus("streaming");
        });
        if (!received.trim()) throw new Error("other");
        setAnswer(received);
        setStatus("done");
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setAnswer(received.trim() ? received : FAILURE_TEXT[err instanceof Error && err.message === "rate" ? "rate" : "other"]);
        setStatus("error");
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    },
    [shopName, vendorId]
  );

  /** 聞く相手を切り替えたら、前の答えは消す */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAnswer("");
    setStatus("idle");
  }, []);

  return { status, answer, busy: status === "thinking" || status === "streaming", ask, reset };
}
