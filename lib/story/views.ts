// 近況（ストーリー）を「見た」と記録するクライアントヘルパー。
// 数えるのはサーバー側（visitor_key 単位で1投稿1回）。失敗しても見る邪魔はしない。

/** 近況を見たことを記録する。結果は待たず、失敗は無視する */
export function recordStoryView(contentId: string, visitorKey: string): void {
  void fetch(`/api/stories/${encodeURIComponent(contentId)}/views`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorKey }),
    keepalive: true,
  }).catch(() => {});
}
