-- 検索ログ（product_search_logs）へのブラウザからの直接 INSERT を閉じる（#627）
--
-- 背景:
-- 検索キーワードはこれまで /search のブラウザから直接 INSERT しており、
-- "anyone can insert search logs"（with check (true)）で匿名にも開いていた。
-- 入力検証もレート制限も効かず、だれでも任意の文字列を書き込めた。
-- 20261007100000_fix_rls_review_findings.sql では「書き込み経路をサーバー側へ移す変更が要る」
-- として残していた分。
--
-- #912 で書き込みを POST /api/analytics/search-log（service role・同一オリジン確認・
-- レート制限・入力検証）に移したので、直接 INSERT の経路を閉じる。
--
-- リリース順の注意:
-- このマイグレーションは #912 と同じか、それより後のリリースで本番に流すこと。
-- #912 より先に流すと、本番の旧コードの直接 INSERT が拒否され、検索ログが記録されなくなる
-- （画面は壊れない。旧コードは INSERT の失敗を無視していた）。
--
-- service role は RLS も以下の GRANT 変更も受けないので、API からの書き込みは影響を受けない。
-- 読み取り（出店者の検索トレンド・管理画面）は SELECT なので、この変更では変わらない。

-- 1. 匿名・認証ユーザーの INSERT ポリシーを外し、権限も剥がす（防御を RLS の 1 枚にしない）
drop policy if exists "anyone can insert search logs" on public.product_search_logs;
revoke insert on public.product_search_logs from anon, authenticated;

-- 2. API の入力検証に合わせた DB 側の上限（二重の守り）
--    既存の行には不正な値が残っている可能性がある（これまで検証なしで書けた）。
--    既存行の検証で失敗しないよう not valid で付け、これから入る行だけを確かめる。
--    DB 側は API の検証より厳しくしない（API が通した値で INSERT が失敗し 500 にならないように）。
--    - キーワードの下限は 1: JS の length は UTF-16 単位で、絵文字1つ（例: 🍊）を 2 と数える。
--      char_length は 1 と数えるので、下限を API と同じ 2 にすると API が通した語を DB が拒む。
--      上限は JS の length ≤ 100 なら char_length ≤ 100 なので API と同じでよい
--    - 件数の上限は API（1000 以下）と同じ
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'product_search_logs_keyword_length'
      and conrelid = 'public.product_search_logs'::regclass
  ) then
    alter table public.product_search_logs
      add constraint product_search_logs_keyword_length
      check (char_length(keyword) between 1 and 100) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'product_search_logs_result_count_range'
      and conrelid = 'public.product_search_logs'::regclass
  ) then
    alter table public.product_search_logs
      add constraint product_search_logs_result_count_range
      check (result_count between 0 and 1000) not valid;
  end if;
end
$$;
