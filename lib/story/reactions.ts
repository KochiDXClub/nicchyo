// ストーリー（近況）のハートリアクション用クライアントヘルパー。
// visitor_key で匿名ユーザーを識別し、1 投稿につき 1 ハートをトグルする。

import {
  chunkArray,
  mergeReactionCounts,
  REACTION_COUNTS_MAX_IDS,
  type ReactionCountsResult,
} from "./reactionCounts";

export type ReactionState = { count: number; reacted: boolean };
export type { ReactionCountsResult } from "./reactionCounts";

/** 指定ストーリーの現在のリアクション状態（総数・自分が押したか）を取得する */
export async function fetchReactionState(
  contentId: string,
  visitorKey: string
): Promise<ReactionState> {
  const res = await fetch(
    `/api/stories/${encodeURIComponent(contentId)}/reactions?visitorKey=${encodeURIComponent(visitorKey)}`
  );
  if (!res.ok) throw new Error("リアクションの取得に失敗しました");
  return (await res.json()) as ReactionState;
}

/** ハートをトグル（付与/解除）し、更新後の状態を返す */
export async function toggleReaction(
  contentId: string,
  visitorKey: string
): Promise<ReactionState> {
  const res = await fetch(`/api/stories/${encodeURIComponent(contentId)}/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorKey }),
  });
  if (!res.ok) throw new Error("リアクションの更新に失敗しました");
  return (await res.json()) as ReactionState;
}

/**
 * 複数投稿のハート数（と visitorKey がハート済みの id）を一括取得する。
 * API の上限（30件/リクエスト）を超える分は自動でチャンク分割してマージする。
 */
export async function fetchReactionCounts(
  contentIds: string[],
  visitorKey?: string
): Promise<ReactionCountsResult> {
  const uniqueIds = Array.from(new Set(contentIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { counts: {}, reactedIds: [] };
  }

  const parts = await Promise.all(
    chunkArray(uniqueIds, REACTION_COUNTS_MAX_IDS).map(async (chunk) => {
      const params = new URLSearchParams({ ids: chunk.join(",") });
      if (visitorKey) params.set("visitorKey", visitorKey);
      const res = await fetch(`/api/reactions/counts?${params.toString()}`);
      if (!res.ok) throw new Error("リアクションの取得に失敗しました");
      return (await res.json()) as ReactionCountsResult;
    })
  );
  return mergeReactionCounts(parts);
}
