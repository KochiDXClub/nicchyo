"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getUpcomingSundayIso } from "@/lib/market/calendar";
import { imageErrorMessage } from "@/lib/image/clientCompression";
import {
  emptyAnswerFor,
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

/**
 * 「お店の育ち」に数える質問。今週の商品は週が変わると答えが空に戻るので、
 * 数に入れると毎週満点から落ちてしまう。数から外すだけで、質問としては残す。
 */
export const countsForGrowth = (question: AskQuestion) => question.tier !== "weekly";

const COMPLETE_CHEER = "ぜんぶ教えてくれて、ありがとう！満点じゃ！";

/** ひとことを出しておく長さ */
const CHEER_MS = 2400;

const isClearAnswer = (answer: AskAnswer) =>
  (answer.id === "shop-photo" && !answer.imageFile) ||
  ((answer.id === "instagram" || answer.id === "x" || answer.id === "website") && !answer.value.trim());

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
  /** 「続きを答える」の途中で「飛ばす」にした質問（画面を閉じるまで聞き直さない） */
  const [queueSkipped, setQueueSkipped] = useState<AskQuestionId[]>([]);
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
  const growthQuestions = useMemo(() => allQuestions.filter(countsForGrowth), [allQuestions]);
  const answeredCount = snapshot
    ? growthQuestions.filter((question) => question.isAnswered(snapshot)).length
    : 0;
  const total = growthQuestions.length;
  const isComplete = total > 0 && answeredCount === total;

  /** まだ答えていない質問のうち、章の並びで先頭のもの */
  const nextUnanswered = useCallback(
    (
      from: VendorAskSnapshot,
      except?: AskQuestionId,
      skipped: readonly AskQuestionId[] = []
    ): AskQuestion | null =>
      studioQuestions(from)
        .flatMap((group) => group.questions)
        .find(
          (question) =>
            question.id !== except && !skipped.includes(question.id) && !question.isAnswered(from)
        ) ?? null,
    []
  );

  const openedQuestion = openId ? (allQuestions.find((q) => q.id === openId) ?? null) : null;

  const open = useCallback((id: AskQuestionId) => {
    setError(null);
    setQueueMode(false);
    setQueueSkipped([]);
    setOpenId(id);
  }, []);

  const close = useCallback(() => {
    setOpenId(null);
    setQueueMode(false);
    setQueueSkipped([]);
    setError(null);
  }, []);

  const startQueue = useCallback(() => {
    if (!snapshot) return;
    const next = nextUnanswered(snapshot);
    if (!next) return;
    setError(null);
    setQueueMode(true);
    setQueueSkipped([]);
    setOpenId(next.id);
  }, [snapshot, nextUnanswered]);

  /** 「続きを答える」の途中で、この質問だけ飛ばして次へ進む */
  const skipCurrent = useCallback(() => {
    if (!snapshot || !openId) return;
    const skipped = [...queueSkipped, openId];
    const next = nextUnanswered(snapshot, openId, skipped);
    setError(null);
    setQueueSkipped(skipped);
    if (next) {
      setOpenId(next.id);
    } else {
      setOpenId(null);
      setQueueMode(false);
      setQueueSkipped([]);
    }
  }, [snapshot, openId, queueSkipped, nextUnanswered]);

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
      const wasComplete = isComplete;
      setSaving(true);
      setError(null);
      try {
        await saveAskAnswer(vendorId, weekDate, answer);
      } catch (err) {
        setError(
          err instanceof AskUserFacingError
            ? err.message
            : imageErrorMessage(err, "うまく保存できんかった。もういっぺんやってみてや。")
        );
        setSaving(false);
        return;
      }
      try {
        // 保存はできている。読み直しに失敗しても「保存できんかった」とは言わない
        // （写真を撮り直して、同じものを二度送らせないため）
        const latest = await fetchAskSnapshot(vendorId, weekDate);
        setSnapshot(latest);

        const remaining = nextUnanswered(latest, answer.id, queueSkipped);
        const nowComplete = studioQuestions(latest)
          .flatMap((group) => group.questions)
          .filter(countsForGrowth)
          .every((question) => question.isAnswered(latest));
        // 答えを消したときは、ほめない
        const cleared = isClearAnswer(answer);
        // 満点のひとことは、この答えで満点になったときだけ（満点のあとに答え直すたびには言わない）
        if (!cleared) showCheer(nowComplete && !wasComplete);

        // 「続きを答える」の最中は、次の質問へそのまま進む。それ以外は閉じる
        if (queueMode && remaining && !cleared) {
          setOpenId(remaining.id);
        } else {
          setOpenId(null);
          setQueueMode(false);
        }
      } catch {
        setError("保存はできたけど、画面を新しくできんかった。開き直すと出るきね。");
      } finally {
        setSaving(false);
      }
    },
    [vendorId, saving, isComplete, weekDate, nextUnanswered, showCheer, queueMode, queueSkipped]
  );

  /** 入れた値を消す（つながり・店舗写真・店主名・ジャンル）。消せない質問では何もしない */
  const clear = useCallback(
    (id: AskQuestionId) => {
      const empty = emptyAnswerFor(id);
      if (empty) void save(empty);
    },
    [save]
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
    skipCurrent,
    clear,
    save,
  };
}
