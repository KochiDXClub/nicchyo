-- content_reactions のパフォーマンス対応（PR #394 レビュー指摘）
-- 1) created_at インデックス：週次ハート集計（analyticsService.fetchVendorHeartSummary の
--    `.gte("created_at", weekAgo)`）の走査を効率化する。
-- 2) 件数集計 RPC：/api/reactions/counts が全行を取得してアプリ側で数える実装だったため、
--    DB 側で GROUP BY して「id ごとの件数」だけを返すようにする。

CREATE INDEX IF NOT EXISTS content_reactions_created_at_idx
  ON content_reactions(created_at);

-- 指定投稿群のハート件数を DB 側で集計して返す。
-- content_reactions は RLS 有効・匿名ポリシー無しのため、SECURITY INVOKER のまま
-- anon から呼ばれても RLS で 0 件になり、実データはサービスロール
-- （RLS バイパス）経由でのみ取得できる。呼び出しは /api/reactions/counts のみ。
CREATE OR REPLACE FUNCTION get_reaction_counts(content_ids uuid[])
RETURNS TABLE (vendor_content_id uuid, cnt bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT cr.vendor_content_id, count(*)::bigint AS cnt
  FROM content_reactions cr
  WHERE cr.vendor_content_id = ANY(content_ids)
  GROUP BY cr.vendor_content_id;
$$;
