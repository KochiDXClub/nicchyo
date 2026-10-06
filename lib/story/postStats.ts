// 出店者の近況ごとの「見た人」「ハート」の数。
// /api/vendor/posts/stats（集計）と出店者の投稿履歴（表示）の両方から使う。

export type PostStats = { views: number; hearts: number };

/** 1リクエストで受け付ける投稿の数（投稿履歴の1ページ分より多めに） */
export const POST_STATS_MAX_IDS = 100;

type CountRow = { vendor_content_id: string; cnt: number | string };

/** DB の件数（get_view_counts / get_reaction_counts の行）を、投稿 id ごとの数にまとめる。数が無い投稿は 0 */
export function toPostStats(
  ids: readonly string[],
  viewRows: readonly CountRow[],
  heartRows: readonly CountRow[]
): Record<string, PostStats> {
  const toMap = (rows: readonly CountRow[]) =>
    new Map(rows.map((row) => [row.vendor_content_id, Number(row.cnt)]));
  const views = toMap(viewRows);
  const hearts = toMap(heartRows);
  return Object.fromEntries(
    ids.map((id) => [id, { views: views.get(id) ?? 0, hearts: hearts.get(id) ?? 0 }])
  );
}

/** 公開中の近況の合計（投稿履歴の上に出す） */
export function sumPostStats(stats: readonly (PostStats | undefined)[]): PostStats {
  return stats.reduce<PostStats>(
    (total, item) => ({ views: total.views + (item?.views ?? 0), hearts: total.hearts + (item?.hearts ?? 0) }),
    { views: 0, hearts: 0 }
  );
}
