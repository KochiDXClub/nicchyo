// ストーリー（近況）のハートリアクション用クライアントヘルパー。
// visitor_key で匿名ユーザーを識別し、1 投稿につき 1 ハートをトグルする。

export type ReactionState = { count: number; reacted: boolean };

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
