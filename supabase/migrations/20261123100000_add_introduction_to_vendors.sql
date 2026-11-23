-- お店の紹介文（出店者が書く平文。店舗バナーの商品の上に出す）。
--
-- 既存の strength（イチ押しポイント）は AI 相談・翻訳・店舗ページの説明文で使われているため、
-- ここでは意味を変えず、新しい列として分けて持つ。
-- 空（null）のときはバナーに何も出さない。上限は 200 文字（アプリ側でも同じ数で検査する）。

alter table public.vendors
  add column if not exists introduction text;

alter table public.vendors
  drop constraint if exists vendors_introduction_length_check;
alter table public.vendors
  add constraint vendors_introduction_length_check
  check (introduction is null or char_length(introduction) <= 200);

comment on column public.vendors.introduction is
  'お店の紹介文（出店者が書く平文、200文字まで）。店舗バナーの商品の上に表示する。';

-- 来訪者の画面（anon / authenticated）が読む列。vendors は列単位で SELECT を付与しているため、ここにも付ける
grant select (introduction) on public.vendors to anon, authenticated;
