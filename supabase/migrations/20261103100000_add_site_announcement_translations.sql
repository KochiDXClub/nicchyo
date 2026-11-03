-- サイト内のお知らせの英語版。
-- 運営は日本語で書き、投稿前に AI 翻訳 → 必要なら手直し → 日本語と英語を一緒に公開する。
-- title_en / body_en が両方あれば英語の来訪者に英語を出し、無ければ日本語のまま出す（フォールバック）。
-- translation_status: auto = AI 訳のまま、reviewed = 運営が手直し・確認した訳。英語版なしは null。
-- 読み書きは引き続き service_role のみ（RLS・権限は create_site_announcements のまま）。

alter table public.site_announcements
  add column if not exists title_en text check (title_en is null or char_length(title_en) between 1 and 240),
  add column if not exists body_en text check (body_en is null or char_length(body_en) between 1 and 8000),
  add column if not exists translation_status text check (translation_status is null or translation_status in ('auto', 'reviewed'));

comment on column public.site_announcements.title_en is '英語のタイトル。title_en と body_en が両方あるときだけ英語の来訪者に出す。';
comment on column public.site_announcements.body_en is '英語の本文。';
comment on column public.site_announcements.translation_status is '英語版の状態。auto=AI訳のまま、reviewed=運営が確認・手直し済み、null=英語版なし。';
