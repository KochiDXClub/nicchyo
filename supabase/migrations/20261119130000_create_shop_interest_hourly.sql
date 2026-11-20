-- お店の詳細が開かれた回数を「日 × 時 × 出店者 × 流入元 → 件数」で持つ shop_interest_hourly を追加する（#1069 PR-2）。
--
-- 背景:
-- shop_page_views は 1 閲覧 1 行で持っている。出店者の「お店の分析」が見せているのは
-- 週ごとの合計・時間帯の棒グラフ（ピークの時間）・流入元（地図 / 検索 / 直接）の割合だけなので、
-- 行ごとのログではなく件数で持てば足りる。
--
-- 方針（Issue の shop_interest_daily(day, shop_id, count) から変えた点）:
--   - 時間帯の棒グラフを残すため、実テーブルは「時間ごと」の件数にする。
--     日ごとは、この表を足し上げる view（shop_interest_daily）にする。書き込みは 1 か所なので、2 つがずれることはない。
--   - 流入元（source）を残す。
--   - キーは店番号ではなく出店者（vendor_id）。店番号は開催日ごとに動く屋台の枠で、
--     書き込む API（POST /api/analytics/shop-view）はすでに出店者をサーバー側で決めている。
-- 日と時は日本時間（日曜市の 1 日の区切り）。
-- この PR では shop_page_views への書き込みはそのまま残す（二重書き込み）。読み手の切り替えは後続の PR。
-- 公開の最小件数（analytics_publish_min_count）はかけない。出店者は今と同じく自店の行だけを見る。

create table if not exists public.shop_interest_hourly (
  day date not null,
  hour smallint not null,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  source text not null,
  count integer not null default 0,
  constraint shop_interest_hourly_hour_check check (hour between 0 and 23),
  constraint shop_interest_hourly_source_check check (source in ('map', 'search', 'direct')),
  constraint shop_interest_hourly_pkey primary key (day, hour, vendor_id, source)
);

-- 出店者ごとに期間で読む（お店の分析）のと、vendors の削除時の cascade のため
create index if not exists shop_interest_hourly_vendor_day_idx
  on public.shop_interest_hourly (vendor_id, day);

-- 出店者は、お店の分析の権限（代表者は常に）がある店舗の行だけを読む。shop_page_views と同じ判定。
-- 書き込みはどのクライアントのロールにも許さない（下の関数を service_role から呼ぶだけ）。
alter table public.shop_interest_hourly enable row level security;
revoke all on table public.shop_interest_hourly from public, anon, authenticated;
grant select on table public.shop_interest_hourly to authenticated, service_role;

drop policy if exists "vendors can read own shop interest" on public.shop_interest_hourly;
create policy "vendors can read own shop interest"
  on public.shop_interest_hourly for select to authenticated
  using (public.has_shop_permission(vendor_id, 'analytics'));

-- 日ごとの件数。security_invoker なので、読む人には上の表の RLS がそのまま効く。
create or replace view public.shop_interest_daily
with (security_invoker = true) as
select day, vendor_id, source, sum(count)::int as count
from public.shop_interest_hourly
group by day, vendor_id, source;

revoke all on table public.shop_interest_daily from public, anon, authenticated;
grant select on table public.shop_interest_daily to authenticated, service_role;

-- 1 件数える。日と時は日本時間。
-- p_at は日付の境目を確かめるため（supabase/checks/shop_interest_hourly.sql）。API は渡さず now() を使う。
-- p_at で好きな日時・好きな出店者の件数を足せるので、anon / authenticated には決して実行を許さない。
-- 関数は既定で PUBLIC が実行できるので、revoke が要る。
create or replace function public.increment_shop_interest(
  p_vendor_id uuid,
  p_source text,
  p_at timestamptz default now()
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.shop_interest_hourly as t (day, hour, vendor_id, source, count)
  values (
    (p_at at time zone 'Asia/Tokyo')::date,
    extract(hour from (p_at at time zone 'Asia/Tokyo'))::smallint,
    p_vendor_id,
    p_source,
    1
  )
  on conflict on constraint shop_interest_hourly_pkey
  do update set count = t.count + 1;
$$;

revoke execute on function public.increment_shop_interest(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.increment_shop_interest(uuid, text, timestamptz) to service_role;
