-- 検索語を「日ごとの件数」だけで数える search_term_daily を追加する（#1069 PR-1）。
--
-- 背景:
-- product_search_logs は来訪者が自由に打った検索語を 1 検索 1 行で持つ。名前や電話番号が入ることがある。
-- 検索語の傾向が知りたいだけなので、行ごとのログではなく「日 × 語 → 件数」で持つ。
--
-- 方針（案 B）:
-- 公開カタログ（店舗名・カテゴリー・商品名）に載っている語だけを term に入れる。
-- 載っていない語（自由入力の名前・電話番号など）は term を NULL にして、日ごとの匿名の 1 行にまとめる。
-- その判定はアプリ側（lib/analytics/searchTermMatch.ts）で行う。
-- この PR では product_search_logs への書き込みはそのまま残す（二重書き込み）。読み手の切り替えは後続の PR。
--
-- NULLS NOT DISTINCT は PostgreSQL 15 以降。既存の 20261106130000_public_vendor_identity.sql が
-- security_invoker（これも 15 以降）を使っているので、同じ前提に乗る。

create table if not exists public.search_term_daily (
  day date not null,
  -- NULL は「カタログに無い語」。個々の語は残さず、日ごとに 1 行へ集約する
  term text,
  count integer not null default 0,
  constraint search_term_daily_term_length check (term is null or char_length(term) between 2 and 100),
  constraint search_term_daily_day_term_key unique nulls not distinct (day, term)
);

-- 直接は誰も読み書きしない（service_role は RLS を通らず、下の関数と view 経由で使う）
alter table public.search_term_daily enable row level security;
revoke all on table public.search_term_daily from public, anon, authenticated;

-- 1 件数える。日付は日本時間（日曜市の 1 日の区切り）。
-- 関数は既定で PUBLIC が実行できるので、revoke が要る。
create or replace function public.increment_search_term_daily(p_term text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.search_term_daily as t (day, term, count)
  values ((now() at time zone 'Asia/Tokyo')::date, p_term, 1)
  on conflict on constraint search_term_daily_day_term_key
  do update set count = t.count + 1;
$$;

revoke execute on function public.increment_search_term_daily(text) from public, anon, authenticated;
grant execute on function public.increment_search_term_daily(text) to service_role;

-- 公開してよい最小件数。少ない件数の語は、特定の 1 人の検索が見えてしまうので出さない。
-- system_settings の analytics_publish_min_count（数値）で変える。無い・数値でないときは 10。
-- 設定の間違いで 1 人分の検索が出たり、view が読めなくなったりしないよう、2〜100000 に収める。
-- 今後の集計テーブルでも同じ基準を使う。
create or replace function public.analytics_publish_min_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select least(greatest(ceil((s.value #>> '{}')::numeric), 2), 100000)::integer
      from public.system_settings s
      where s.key = 'analytics_publish_min_count'
        and jsonb_typeof(s.value) = 'number'
    ),
    10
  );
$$;

revoke execute on function public.analytics_publish_min_count() from public, anon, authenticated;
grant execute on function public.analytics_publish_min_count() to service_role;

-- 公開してよい語だけの view（NULL の匿名行と、件数が基準に届かない語は出さない）。
-- 今は読み手がいない。検索候補の PR で使う。
create or replace view public.search_term_daily_public
with (security_invoker = true) as
select day, term, count
from public.search_term_daily
where term is not null
  and count >= public.analytics_publish_min_count();

revoke all on table public.search_term_daily_public from public, anon, authenticated;
grant select on table public.search_term_daily_public to service_role;
