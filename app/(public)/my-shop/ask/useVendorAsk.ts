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
import {
  AskUserFacingError,
  fetchAskSnapshot,
  saveAskAnswer,
} from "@/app/vendor/_services/askService";

/**
 * loading … 読み込み中
 * idle    … 待っている。聞きたいことがあれば「！」を出し、押されたら asking へ
 * asking  … 質問している
 * done    … 1回ぶん聞き終わった（お礼を言う。聞くことが残っていれば、また「！」を出す）
 * error   … 読み込みに失敗した
 */
export type VendorAskStatus = "loading" | "idle" | "asking" | "done" | "error";

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
 * 質問はいきなり始めない。開いたときは待っていて（idle）、聞きたいことがあれば
 * pendingCount が 1 以上になる。出店者が「！」を押したら start() で始める。
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
        setStatus("idle");
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
        // 読めば対処できる理由（例:「先に看板商品を登録してください」）は隠さずに出す
        setError(
          err instanceof AskUserFacingError
            ? err.message
            : imageErrorMessage(err, "うまく保存できんかった。もういっぺんやってみてや。")
        );
      } finally {
        setSaving(false);
      }
    },
    [vendorId, current, saving, weekDate, step, pickNext]
  );

  /** 「！」を押したとき。1回ぶんの数え方を最初からにして、聞き始める */
  const start = useCallback(() => {
    if (!snapshot || saving) return;
    setStep(0);
    setTotal(0);
    setError(null);
    maniacAskedRef.current = false;
    pickNext(snapshot, 0);
  }, [snapshot, saving, pickNext]);

  /** 途中でやめる。「あとで」と違い、やめた質問は次に「！」を押せばまた聞く */
  const stop = useCallback(() => {
    if (saving) return;
    setCurrent(null);
    setError(null);
    setStatus("idle");
  }, [saving]);

  const skip = useCallback(() => {
    if (!current || !snapshot || saving) return;
    skippedRef.current = [...skippedRef.current, current.id];
    writeSkipped(weekDate, skippedRef.current);
    setError(null);
    const resolved = step + 1;
    setStep(resolved);
    pickNext(snapshot, resolved);
  }, [current, snapshot, saving, weekDate, step, pickNext]);

  /** いま「！」を押したら聞く質問の数（あとで・今回聞いた質問は除く）。軽い計算なので毎回数える */
  const pendingCount = snapshot
    ? pickQuestions(snapshot, { skippedIds: [...skippedRef.current, ...handledRef.current] }).length
    : 0;

  return {
    status,
    snapshot,
    current,
    step,
    total,
    pendingCount,
    saving,
    error,
    start,
    stop,
    answer,
    skip,
  };
}
