// ハートリアクションのバッチ集計用の純粋ロジック。
// /api/reactions/counts ルートとクライアントヘルパーの両方から使う。

export type ReactionCountsResult = {
  /** vendor_content_id → ハート数 */
  counts: Record<string, number>;
  /** visitorKey がハート済みの vendor_content_id 一覧 */
  reactedIds: string[];
};

/** 1リクエストで受け付ける vendor_content_id の上限 */
export const REACTION_COUNTS_MAX_IDS = 30;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * カンマ区切りの ids パラメータを検証済みUUID配列にする（重複除去つき）
 */
export function parseContentIdsParam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id && UUID_PATTERN.test(id)) {
      seen.add(id.toLowerCase());
    }
  }
  return Array.from(seen);
}

/**
 * content_reactions の行を counts / reactedIds に集約する
 */
export function aggregateReactionRows(
  rows: Array<{ vendor_content_id: string; visitor_key: string }>,
  visitorKey?: string | null
): ReactionCountsResult {
  const counts: Record<string, number> = {};
  const reacted = new Set<string>();
  for (const row of rows) {
    counts[row.vendor_content_id] = (counts[row.vendor_content_id] ?? 0) + 1;
    if (visitorKey && row.visitor_key === visitorKey) {
      reacted.add(row.vendor_content_id);
    }
  }
  return { counts, reactedIds: Array.from(reacted) };
}

/** 配列を size ごとのチャンクに分割する */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** 複数リクエスト分の結果をマージする（チャンク間で id は重複しない前提） */
export function mergeReactionCounts(
  parts: ReactionCountsResult[]
): ReactionCountsResult {
  const counts: Record<string, number> = {};
  const reacted = new Set<string>();
  for (const part of parts) {
    Object.assign(counts, part.counts);
    part.reactedIds.forEach((id) => reacted.add(id));
  }
  return { counts, reactedIds: Array.from(reacted) };
}
