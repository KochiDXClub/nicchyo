"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getUpcomingSundayIso } from "@/lib/market/calendar";
import { imageErrorMessage } from "@/lib/image/clientCompression";
import {
  studioQuestions,
  type AskAnswer,
  type AskQuestion,
  type AskQuestionId,
  type VendorAskSnapshot,
} from "@/lib/vendor/askQuestions";
import { AskUserFacingError, fetchAskSnapshot, saveAskAnswer } from "../_services/askService";

/** 答えてもらったあとの、にちよさんのひとこと */
const CHEERS = [
  "ええねぇ！",
  "助かるき！",
  "ばっちりじゃ！",
  "お客さんも喜ぶぜよ！",
  "さすがじゃねぇ！",
  "ありがとうねぇ！",
] as const;

const COMPLETE_CHEER = "ぜんぶ教えてくれて、ありがとう！満点じゃ！";

/** ひとことを出しておく長さ */
const CHEER_MS = 2400;

export type StoreStudioStatus = "loading" | "ready" | "error";

/**
 * 店舗情報の編集画面（にちよさんと一緒にお店のプロフィールを育てる画面）の状態。
 *
 * 保存ボタンは無い。1つ答えるたびにその場で保存し、保存後の最新の状態を読み直す。
 * 「続きを答える」は、まだ答えていない質問を章の並びで順に開く。
 */
export function useStoreStudio(vendorId: string | null) {
  const weekDate = useMemo(() => getUpcomingSundayIso(), []);

  const [status, setStatus] = useState<StoreStudioStatus>("loading");
  const [snapshot, setSnapshot] = useState<VendorAskSnapshot | null>(null);
  const [openId, setOpenId] = useState<AskQuestionId | null>(null);
  /** 「続きを答える」で順に聞いている最中か */
  const [queueMode, setQueueMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 答えたあとのひとこと。key を変えて、続けて答えても出し直す */
  const [cheer, setCheer] = useState<{ key: number; text: string; complete: boolean } | null>(null);

  const cheerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cheerCount = useRef(0);

  useEffect(
    () => () => {
      if (cheerTimer.current) clearTimeout(cheerTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    fetchAskSnapshot(vendorId, weekDate)
      .then((loaded) => {
        if (cancelled) return;
        setSnapshot(loaded);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId, weekDate]);

  const groups = useMemo(() => (snapshot ? studioQuestions(snapshot) : []), [snapshot]);
  const allQuestions = useMemo(() => groups.flatMap((group) => group.questions), [groups]);
  const answeredCount = snapshot
    ? allQuestions.filter((question) => question.isAnswered(snapshot)).length
    : 0;
  const total = allQuestions.length;
  const isComplete = total > 0 && answeredCount === total;

  /** まだ答えていない質問のうち、章の並びで先頭のもの */
  const nextUnanswered = useCallback(
    (from: VendorAskSnapshot, except?: AskQuestionId): AskQuestion | null =>
      studioQuestions(from)
        .flatMap((group) => group.questions)
        .find((question) => question.id !== except && !question.isAnswered(from)) ?? null,
    []
  );

  const openedQuestion = openId ? (allQuestions.find((q) => q.id === openId) ?? null) : null;

  const open = useCallback((id: AskQuestionId) => {
    setError(null);
    setQueueMode(false);
    setOpenId(id);
  }, []);

  const close = useCallback(() => {
    setOpenId(null);
    setQueueMode(false);
    setError(null);
  }, []);

  const startQueue = useCallback(() => {
    if (!snapshot) return;
    const next = nextUnanswered(snapshot);
    if (!next) return;
    setError(null);
    setQueueMode(true);
    setOpenId(next.id);
  }, [snapshot, nextUnanswered]);

  const showCheer = useCallback((complete: boolean) => {
    cheerCount.current += 1;
    setCheer({
      key: cheerCount.current,
      text: complete ? COMPLETE_CHEER : CHEERS[Math.floor(Math.random() * CHEERS.length)],
      complete,
    });
    if (cheerTimer.current) clearTimeout(cheerTimer.current);
    cheerTimer.current = setTimeout(() => setCheer(null), CHEER_MS);
  }, []);

  const save = useCallback(
    async (answer: AskAnswer) => {
      if (!vendorId || saving) return;
      setSaving(true);
      setError(null);
      try {
        await saveAskAnswer(vendorId, weekDate, answer);
        const latest = await fetchAskSnapshot(vendorId, weekDate);
        setSnapshot(latest);

        const remaining = nextUnanswered(latest, answer.id);
        const nowComplete = studioQuestions(latest)
          .flatMap((group) => group.questions)
          .every((question) => question.isAnswered(latest));
        showCheer(nowComplete);

        // 「続きを答える」の最中は、次の質問へそのまま進む。それ以外は閉じる
        if (queueMode && remaining) {
          setOpenId(remaining.id);
        } else {
          setOpenId(null);
          setQueueMode(false);
        }
      } catch (err) {
        setError(
          err instanceof AskUserFacingError
            ? err.message
            : imageErrorMessage(err, "うまく保存できんかった。もういっぺんやってみてや。")
        );
      } finally {
        setSaving(false);
      }
    },
    [vendorId, saving, weekDate, nextUnanswered, showCheer, queueMode]
  );

  return {
    status,
    snapshot,
    groups,
    answeredCount,
    total,
    isComplete,
    openedQuestion,
    queueMode,
    saving,
    error,
    cheer,
    open,
    close,
    startQueue,
    save,
  };
}
