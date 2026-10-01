"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getUpcomingSundayIso } from "@/lib/market/calendar";
import { imageErrorMessage } from "@/lib/image/clientCompression";
import {
  pendingQuestions,
  type AskAnswer,
  type AskQuestionId,
  type VendorAskSnapshot,
} from "@/lib/vendor/askQuestions";
import {
  AskUserFacingError,
  fetchAskSnapshot,
  saveAskAnswer,
} from "@/app/vendor/_services/askService";

/** 出店者の今の状態を読む。読み終わるまでは null */
function useAskSnapshot(vendorId: string | null) {
  const weekDate = useMemo(() => getUpcomingSundayIso(), []);
  const [snapshot, setSnapshot] = useState<VendorAskSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    fetchAskSnapshot(vendorId, weekDate)
      .then((loaded) => {
        if (!cancelled) setSnapshot(loaded);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId, weekDate]);

  return { weekDate, snapshot, setSnapshot, failed };
}

/**
 * 出店者トップの「！」（受信箱）に出す数。
 * いま入力が要る質問の数をそのまま数える（「あとで」にしたものも減らさない）。
 */
export function useVendorAskInbox(vendorId: string | null) {
  const { snapshot, failed } = useAskSnapshot(vendorId);
  const status: "loading" | "ready" | "error" = failed ? "error" : snapshot ? "ready" : "loading";
  const pendingCount = snapshot ? pendingQuestions(snapshot).length : 0;
  return { status, pendingCount };
}

export type VendorAskStatus = "loading" | "asking" | "done" | "error";

/**
 * 質問ページ（/my-shop/ask）の進行。
 *
 * 入力が要る質問を順に聞く。出店者はいつでも「×」で抜けられるので、1回に聞く数の
 * 上限は設けない。「あとで」にした質問はこの回では聞き直さないが、答えたことには
 * ならないので、次に「！」から開けばまた聞く。
 * 1問ごとに保存後の最新の状態から選び直す（看板商品を答えた直後に、その商品のPRを
 * 続けて聞けるようにするため）。
 */
export function useVendorAsk(vendorId: string | null) {
  const { weekDate, snapshot, setSnapshot, failed } = useAskSnapshot(vendorId);

  /** この回で「あとで」にした質問 */
  const [skipped, setSkipped] = useState<AskQuestionId[]>([]);
  /** この回で答えた数 */
  const [answeredCount, setAnsweredCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 保存後の状態では未回答に見えても、この回ですでに答えた質問は出し直さない */
  const handledRef = useRef<AskQuestionId[]>([]);

  /** 一覧から選んだ質問。答えるか飛ばすまでは、順番より優先して聞く */
  const [focusId, setFocusId] = useState<AskQuestionId | null>(null);

  /** この回でまだ答えていない質問（「あとで」にしたものも含む）。一覧に出す */
  const unanswered = (snapshot ? pendingQuestions(snapshot) : []).filter(
    (question) => !handledRef.current.includes(question.id)
  );
  const queue = unanswered.filter((question) => !skipped.includes(question.id));
  const current = queue.find((question) => question.id === focusId) ?? queue[0] ?? null;

  const status: VendorAskStatus = failed ? "error" : !snapshot ? "loading" : current ? "asking" : "done";

  const answer = useCallback(
    async (value: AskAnswer) => {
      if (!vendorId || !current || saving) return;
      setSaving(true);
      setError(null);
      try {
        await saveAskAnswer(vendorId, weekDate, value);
      } catch (err) {
        // 読めば対処できる理由（例:「先に看板商品を登録してください」）は隠さずに出す
        setError(
          err instanceof AskUserFacingError
            ? err.message
            : imageErrorMessage(err, "うまく保存できんかった。もういっぺんやってみてや。")
        );
        setSaving(false);
        return;
      }

      // ここからは保存できたあと。読み直しに失敗しても「保存できんかった」とは言わない
      // （同じ写真をもう一度送らせてしまうため）。答えた質問として先へ進む
      handledRef.current = [...handledRef.current, current.id];
      setFocusId(null);
      setAnsweredCount((count) => count + 1);
      try {
        setSnapshot(await fetchAskSnapshot(vendorId, weekDate));
      } catch {
        setError("保存はできたけど、画面を新しくできんかった。開き直すと出るきね。");
      } finally {
        setSaving(false);
      }
    },
    [vendorId, current, saving, weekDate, setSnapshot]
  );

  const skip = useCallback(() => {
    if (!current || saving) return;
    setError(null);
    setFocusId(null);
    setSkipped((prev) => [...prev, current.id]);
  }, [current, saving]);

  /** 一覧で選んだ質問へ飛ぶ。「あとで」にしていた質問も、選べばまた聞く */
  const jumpTo = useCallback(
    (id: AskQuestionId) => {
      if (saving) return;
      setError(null);
      setSkipped((prev) => prev.filter((skippedId) => skippedId !== id));
      setFocusId(id);
    },
    [saving]
  );

  return {
    status,
    snapshot,
    current,
    /** まだ答えていない質問の一覧（「あとで」にしたものも含む）と、「あとで」にした質問 */
    unanswered,
    skippedIds: skipped,
    answeredCount,
    skippedCount: skipped.length,
    saving,
    error,
    answer,
    skip,
    jumpTo,
  };
}
