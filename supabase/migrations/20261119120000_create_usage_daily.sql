-- 機能ごとの利用回数を「日 × 機能 × 丁目 → 件数」で数える usage_daily を追加する（#1069 PR-3）。
--
-- 数える単位は「1 回の訪問（タブ）につき 1 機能 1 回」。重複の判定は端末の sessionStorage だけで行い、
-- 端末を見分ける ID はサーバーへ送らない。ここには件数しか残らない。
-- area は当面 'unknown' 固定。位置情報の許可が入ったあと、端末上の丁目判定
-- （lib/map/chomeFromLocation.ts）の結果を受け取る PR で埋める。
-- 運営だけが見る数字なので、公開用の view は作らない（運営画面は service role で読む）。

-- 計測の「どの丁目か」。後続の集計テーブル（chome_presence・shop_distance）でも使う。
-- '1'〜'7' は lib/map/chomes.ts の ChomeId（1〜7）と揃える。丁目を増やすときは両方を直す。
-- create domain には if not exists が無いので、2 回目の適用で落ちないよう存在を確かめる。
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'analytics_area'
  ) then
    create domain public.analytics_area as text
      check (value in ('1', '2', '3', '4', '5', '6', '7', 'outside', 'unknown'));
  end if;
end $$;

create table if not exists public.usage_daily (
  day date not null,
  feature text not null check (feature in ('map', 'consult', 'search', 'shop')),
  area public.analytics_area not null default 'unknown',
  count integer not null default 0,
  primary key (day, feature, area)
);

-- 直接は誰も読み書きしない（service_role は RLS を通らず、下の関数経由で数える）
alter table public.usage_daily enable row level security;
revoke all on table public.usage_daily from public, anon, authenticated;

-- 1 件数える。日付は日本時間（日曜市の 1 日の区切り）。area はまだ端末から受け取らない。
-- 関数は既定で PUBLIC が実行できるので、revoke が要る。
create or replace function public.increment_usage_daily(p_feature text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.usage_daily as t (day, feature, area, count)
  values ((now() at time zone 'Asia/Tokyo')::date, p_feature, 'unknown', 1)
  on conflict (day, feature, area)
  do update set count = t.count + 1;
$$;

revoke execute on function public.increment_usage_daily(text) from public, anon, authenticated;
grant execute on function public.increment_usage_daily(text) to service_role;
