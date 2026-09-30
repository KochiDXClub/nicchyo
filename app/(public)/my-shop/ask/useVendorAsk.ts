"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getUpcomingSundayIso } from "@/lib/market/calendar";
import { imageErrorMessage } from "@/lib/image/clientCompression";
import {
  ASK_LIMIT,
  pickQuestions,
  type AskAnswer,
  type AskQuestion,
  type AskQuestionId,
  type VendorAskSnapshot,
} from "@/lib/vendor/askQuestions";
import { fetchAskSnapshot, saveAskAnswer } from "@/app/vendor/_services/askService";

export type VendorAskStatus = "loading" | "asking" | "done" | "error";

/** 「あとで」にした質問は、同じ週のうちは出し直さない。週が変われば別のキーになる */
const skippedStorageKey = (weekDate: string) => `nicchyo-vendor-ask-skipped:${weekDate}`;

function readSkipped(weekDate: string): AskQuestionId[] {
  try {
    const raw = window.localStorage.getItem(skippedStorageKey(weekDate));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AskQuestionId[]) : [];
  } catch {
    return [];
  }
}

function writeSkipped(weekDate: string, ids: AskQuestionId[]) {
  try {
    window.localStorage.setItem(skippedStorageKey(weekDate), JSON.stringify(ids));
  } catch {
    // 保存できなくても質問自体は続けられるので握りつぶす
  }
}

/**
 * 出店者ページの「にちよさんの質問」の進行。
 *
 * 1回に聞くのは ASK_LIMIT 個まで（答えた数と「あとで」の数を合わせて数える）。
 * 質問は1問ごとに、保存後の最新の状態から選び直す。看板商品を答えた直後に
 * その商品のPRを続けて聞けるようにするため。
 */
export function useVendorAsk(vendorId: string | null) {
  const weekDate = useMemo(() => getUpcomingSundayIso(), []);

  const [status, setStatus] = useState<VendorAskStatus>("loading");
  const [snapshot, setSnapshot] = useState<VendorAskSnapshot | null>(null);
  const [current, setCurrent] = useState<AskQuestion | null>(null);
  /** この回で答えた・あとでにした数 */
  const [step, setStep] = useState(0);
  /** 今回の質問の総数の見込み。先の質問が増えることはあっても減らさない */
  const [total, setTotal] = useState(0);
  /** 最初から聞くことが無かったか（終わりのひとことを変えるため） */
  const [startedEmpty, setStartedEmpty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skippedRef = useRef<AskQuestionId[]>([]);
  /** 保存後の状態では未回答に見えても、今回すでに聞いた質問（例: 雨の日の既定値）を出し直さない */
  const handledRef = useRef<AskQuestionId[]>([]);
  const maniacAskedRef = useRef(false);

  const pickNext = useCallback(
    (latest: VendorAskSnapshot, resolved: number) => {
      if (resolved >= ASK_LIMIT) {
        setCurrent(null);
        setStatus("done");
        return;
      }
      const options = {
        skippedIds: [...skippedRef.current, ...handledRef.current],
        allowManiac: !maniacAskedRef.current,
      };
      const remaining = pickQuestions(latest, { ...options, limit: ASK_LIMIT - resolved });
      const next = remaining[0];
      if (!next) {
        setCurrent(null);
        setStatus("done");
        return;
      }
      if (next.tier === "maniac") maniacAskedRef.current = true;
      setTotal((prev) => Math.max(prev, resolved + remaining.length));
      setCurrent(next);
      setStatus("asking");
    },
    []
  );

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    skippedRef.current = readSkipped(weekDate);
    fetchAskSnapshot(vendorId, weekDate)
      .then((loaded) => {
        if (cancelled) return;
        setSnapshot(loaded);
        const firstPick = pickQuestions(loaded, { skippedIds: skippedRef.current });
        setStartedEmpty(firstPick.length === 0);
        pickNext(loaded, 0);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId, weekDate, pickNext]);

  const answer = useCallback(
    async (value: AskAnswer) => {
      if (!vendorId || !current || saving) return;
      setSaving(true);
      setError(null);
      try {
        await saveAskAnswer(vendorId, weekDate, value);
        const latest = await fetchAskSnapshot(vendorId, weekDate);
        handledRef.current = [...handledRef.current, current.id];
        setSnapshot(latest);
        const resolved = step + 1;
        setStep(resolved);
        pickNext(latest, resolved);
      } catch (err) {
        setError(imageErrorMessage(err, "うまく保存できんかった。もういっぺんやってみてや。"));
      } finally {
        setSaving(false);
      }
    },
    [vendorId, current, saving, weekDate, step, pickNext]
  );

  const skip = useCallback(() => {
    if (!current || !snapshot || saving) return;
    skippedRef.current = [...skippedRef.current, current.id];
    writeSkipped(weekDate, skippedRef.current);
    setError(null);
    const resolved = step + 1;
    setStep(resolved);
    pickNext(snapshot, resolved);
  }, [current, snapshot, saving, weekDate, step, pickNext]);

  return { status, snapshot, current, step, total, startedEmpty, saving, error, answer, skip };
}
