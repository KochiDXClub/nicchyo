-- おでかけサポートの利用ログ。
-- 「どのスポット・どの条件が求められているか」を把握し、スポットデータを
-- 何から充実させるかの判断材料にする（docs: おでかけサポート改善計画）。
--
--   event_type : open（案内を開いた）/ navigation_start（案内をはじめた）/
--                arrived（到着）/ navigation_stop（途中でやめた）
--   preset_id  : go-home / restroom / rain … （プリセットから開いたとき）
--   kinds      : 表示していた種類（restroom / rest / transit / landmark）
--   spot_key   : 案内先の map_landmarks.key（navigation_* / arrived のとき）
--   origin_type: geolocation / map-center / spot / venue
--
-- shop_interactions と同じく、書き込みは API（service role）だけ。
-- 個人を特定する情報は持たず、visitor_key は他の解析テーブルと同じ匿名キー。

create table if not exists guide_events (
  id uuid primary key default gen_random_uuid(),
  visitor_key text,
  event_type text not null check (event_type in ('open', 'navigation_start', 'arrived', 'navigation_stop')),
  preset_id text,
  kinds text[] not null default '{}',
  spot_key text,
  origin_type text,
  walk_minutes integer,
  distance_meters integer,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_guide_events_created_at on guide_events (created_at desc);
create index if not exists idx_guide_events_event_type on guide_events (event_type);
create index if not exists idx_guide_events_spot_key on guide_events (spot_key);

alter table guide_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'guide_events' and policyname = 'guide_events_admin_select'
  ) then
    create policy guide_events_admin_select
      on guide_events for select
      to authenticated
      -- user_metadata はユーザー自身が書き換えられるため、app_metadata だけを信頼する。
      -- super_admin は 20260806104907 で admin に統合済みなので判定に含めない
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  end if;
end $$;

-- 公開 INSERT ポリシーは作らない（service role のみ）

-- 変更の目的:
--   おでかけサポートの利用状況（開始・到着・離脱、案内先スポット、条件）を記録し、
--   管理画面の統計に出す。
