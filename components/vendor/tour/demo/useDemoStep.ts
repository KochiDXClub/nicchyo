"use client";

import { useCallback, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/** 1工程の長さ。最後の工程だけ、結果を読めるよう長めに止める */
const STEP_MS = 2000;
const LAST_STEP_MS = 3400;

/**
 * デモの工程（0 から count-1）を、一定の間隔で順に進めて繰り返す。
 * 「動きを減らす」設定のときは進めず、結果が見える最後の工程で止める（字幕を押せば順に見られる）。
 */
export function useDemoStep(count: number) {
  const reduce = useReducedMotion() ?? false;
  const [step, setStep] = useState(reduce ? count - 1 : 0);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (reduce) setStep(count - 1);
  }, [reduce, count]);

  useEffect(() => {
    if (reduce || count <= 1) return;
    const id = window.setTimeout(
      () => setStep((current) => (current + 1) % count),
      step === count - 1 ? LAST_STEP_MS : STEP_MS
    );
    return () => window.clearTimeout(id);
  }, [step, count, reduce, epoch]);

  /** 字幕を押して、その工程へ。そこから数え直す */
  const select = useCallback((index: number) => {
    setStep(index);
    setEpoch((value) => value + 1);
  }, []);

  return { step, select, reduce };
}
