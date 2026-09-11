-- ログ系テーブルの匿名・認証ユーザー権限を絞る（#629）
--
-- 背景:
-- これらの表は RLS が有効で、anon から実際に読もうとしても 0 件しか返らない。
-- しかし GRANT は anon にも SELECT / UPDATE / DELETE / TRUNCATE まで付いたままで、
-- 防御が RLS の 1 枚しかない。ポリシーを 1 つ緩めた時点で露出する。
-- vendors は 20260807112200 で列単位 GRANT に絞る対応済みなので、同じ考え方を適用する。
--
-- 方針:
--   - 破壊的な権限（UPDATE / DELETE / TRUNCATE / REFERENCES / TRIGGER）は両ロールから剥がす。
--     これらを使うコードは無く、消去や集計の削除は service_role 経由で行っている。
--   - anon からは SELECT も剥がす。公開画面がログを読む場面は無い。
--   - INSERT は残す。ブラウザから直接書く経路があるため（下記）。実際に書けるかどうかは
--     引き続き RLS のポリシーが決める。
--
-- 書き込み経路の実地確認:
--   ai_consult_logs      service role（app/api/grandma/ask）
--   product_search_logs  ブラウザ（app/vendor/_services/analyticsService）
--   web_page_analytics   cookie クライアント（app/api/analytics/page-visit）
--   guide_events         service role（app/api/analytics/guide-event。直接 INSERT 不可と明記）
--   shop_page_views      service role（app/api/analytics/shop-interaction）
--
-- 読み取り経路（authenticated の SELECT を残す理由）:
--   ai_consult_logs      出店者が自店分を読む / 管理画面の解析
--   product_search_logs  認証ユーザーが読む既存ポリシーあり
--   web_page_analytics   管理者が読む
--   guide_events         管理者が読む
--   shop_page_views      出店者が自店分を読む

do $$
declare
  t text;
begin
  foreach t in array array[
    'ai_consult_logs',
    'product_search_logs',
    'web_page_analytics',
    'guide_events',
    'shop_page_views'
  ]
  loop
    -- 破壊的な権限は両ロールから剥がす
    execute format(
      'revoke update, delete, truncate, references, trigger on public.%I from anon, authenticated',
      t
    );
    -- 匿名からの読み取りは不要
    execute format('revoke select on public.%I from anon', t);
  end loop;
end
$$;
