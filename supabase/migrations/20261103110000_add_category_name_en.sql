-- カテゴリー（店舗のジャンル）の英語名。運営が日本語名と一緒に管理画面で入力する（AI翻訳 → 確認・編集）。
-- 無ければ、英語の画面でも日本語名のまま出す。RLS・権限は create_categories_table / enable_categories_rls のまま。

alter table public.categories
  add column if not exists name_en text check (name_en is null or char_length(name_en) between 1 and 100);

comment on column public.categories.name_en is 'カテゴリーの英語名。null なら日本語名のまま表示する。';
