-- =====================================================================
-- マップの表示範囲（動かせる範囲）の設定
--
-- 目的:
--   マップの可動範囲は「道の範囲＋余白」をコードに焼いた式で決めていた。
--   余白が足りないと引いたときに市場の外側が見えず窮屈に感じるが、
--   どれくらい外側まで見せるかは運用の判断で、コード変更 → PR → デプロイを
--   待つ性質のものではない。管理画面（/admin/map-view）から動かせるようにする。
--
-- 行は1つ（key = 'default'）。将来「イベント時だけ広げる」のように
-- 名前つきで複数持つ余地を残して key を主キーにしてある。
-- map_route_configs と同じ形。
--
-- 決め方は2つ。
--   auto   … 道の範囲に padding_meters を足した長方形。道を編集すると追従する
--   manual … 管理画面で四隅をドラッグして決めた長方形をそのまま使う
--
-- 値は jsonb ではなく列に分ける。四辺と余白とズームは形が決まっていて、
-- 壊れた値が入ると「マップが操作できない」形で本番に出るため、
-- CHECK 制約でDB側でも止められるようにしておく。
-- =====================================================================

create table if not exists map_view_settings (
  key text primary key,

  -- 'auto' | 'manual'
  mode text not null default 'auto',

  -- auto のときに道の範囲へ足す余白（m）。
  -- 既定の 720 は、設定を入れる前に MapViewMapLibre が使っていた式
  -- max(visible_distance_meters + 48, 120) + 600 を既定値で計算した値。
  -- 既定のままなら今までと同じ範囲になる
  padding_meters double precision not null default 720,

  -- manual のときの長方形。auto のときは null
  north double precision,
  south double precision,
  east double precision,
  west double precision,

  -- どこまで引けるか（Leaflet 基準のズーム値。MapLibre 版は 1 引いて使う）
  min_zoom double precision not null default 15,

  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint map_view_settings_mode_valid check (mode in ('auto', 'manual')),

  -- 上限はアプリ側（lib/map/mapViewSettings.ts の MAP_VIEW_LIMITS）と同値。
  -- 桁を間違えた余白が入ると、日曜市が点になるほど引ける地図になってしまう
  constraint map_view_settings_padding_bounded check (
    padding_meters >= 0 and padding_meters <= 5000
  ),
  constraint map_view_settings_min_zoom_bounded check (
    min_zoom >= 10 and min_zoom <= 18
  ),

  -- manual なのに四辺が欠けていると可動範囲が決まらない
  constraint map_view_settings_manual_needs_bounds check (
    mode <> 'manual'
    or (north is not null and south is not null and east is not null and west is not null)
  ),

  -- 南北・東西が逆、辺が短すぎる／長すぎる長方形を弾く。
  -- 潰れた枠を保存できてしまうと、マップがその一点から動かせなくなる
  constraint map_view_settings_bounds_ordered check (
    (north is null or south is null or north - south between 0.001 and 0.5)
    and (east is null or west is null or east - west between 0.001 and 0.5)
  ),
  constraint map_view_settings_bounds_ranged check (
    (north is null or north between -90 and 90)
    and (south is null or south between -90 and 90)
    and (east is null or east between -180 and 180)
    and (west is null or west between -180 and 180)
  )
);

-- 行が無いとアプリはコード側の既定値で動く（画面には何も出ない）ので、
-- 既定値と同じ内容の行を1つ入れておく
insert into map_view_settings (key, mode, padding_meters, min_zoom)
values ('default', 'auto', 720, 15)
on conflict (key) do nothing;

create or replace function public.map_view_settings_touch_updated_at()
returns trigger
language plpgsql
-- search_path は空にする。関数内の参照はすべて完全修飾してあるので、
-- 将来この規律が崩れた時点で解決できずエラーになり、劣化が静かに入らない
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.map_view_settings_touch_updated_at() from public, anon, authenticated;

drop trigger if exists map_view_settings_touch_updated_at on map_view_settings;
create trigger map_view_settings_touch_updated_at
  before insert or update on map_view_settings
  for each row execute function public.map_view_settings_touch_updated_at();

-- ─── 権限 ──────────────────────────────────────────────────────────────
-- 読みは公開。マップページ（未ログインの来訪者）が表示範囲を知る必要がある。
-- 中身は「どこからどこまで地図を動かせるか」だけで、秘密の情報は含まない
-- （map_route_points / map_route_configs と同じ扱い）。
-- 書き込みはポリシーを作らない＝ service role（管理APIのみ）に限る。
alter table map_view_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'map_view_settings'
      and policyname = 'public read map_view_settings'
  ) then
    create policy "public read map_view_settings"
    on map_view_settings
    for select
    using (true);
  end if;
end
$$;

-- 読み取り以外の権限はブラウザ由来のロールから剥がす
-- （Supabase は public スキーマの新規テーブルに既定で権限を付けるため）
revoke all on public.map_view_settings from anon, authenticated;
grant select on public.map_view_settings to anon, authenticated;
