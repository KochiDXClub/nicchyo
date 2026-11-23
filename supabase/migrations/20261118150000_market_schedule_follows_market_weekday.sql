-- 開催日の制約を、固定の日曜ではなく市の開催曜日（markets.weekday）に従わせる。
-- 日曜市の行はそのまま日曜として通り、木曜市の行は木曜として通る。
-- 日付の曜日チェックは、市の曜日を引く関数（market_weekday_for_location）を使うトリガーで行う。
-- check 制約では他テーブルを参照できないため、制約は外してトリガーに置き換える。

create or replace function public.market_weekday_for_location(p_location uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select m.weekday
  from public.market_locations l
  join public.markets m on m.id = l.market_id
  where l.id = p_location
$$;

revoke all on function public.market_weekday_for_location(uuid) from public;
grant execute on function public.market_weekday_for_location(uuid) to service_role;

-- 日付が、その場所の市の開催曜日かどうか
create or replace function public.market_day_matches_location(p_location uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_date is not null
    and extract(dow from p_date) = public.market_weekday_for_location(p_location),
    false)
$$;

revoke all on function public.market_day_matches_location(uuid, date) from public;
grant execute on function public.market_day_matches_location(uuid, date) to service_role;

-- 予定（rules）の日付を、所属する場所の市の曜日に合わせる
create or replace function public.assert_market_rule_weekday()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_location uuid;
begin
  select m.location_id into v_location from public.market_place_memberships m where m.id = new.membership_id;
  if not public.market_day_matches_location(v_location, new.starts_on) then
    raise exception '開催日が市の開催曜日と合いません' using errcode = 'check_violation';
  end if;
  if new.ends_on is not null and not public.market_day_matches_location(v_location, new.ends_on) then
    raise exception '終了日が市の開催曜日と合いません' using errcode = 'check_violation';
  end if;
  if new.anchor_on is not null and not public.market_day_matches_location(v_location, new.anchor_on) then
    raise exception '基準日が市の開催曜日と合いません' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- 例外（overrides）の日付を、その場所の市の曜日に合わせる
create or replace function public.assert_market_override_weekday()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.market_day_matches_location(new.location_id, new.market_date) then
    raise exception '日付が市の開催曜日と合いません' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- 旧: 日曜固定の check 制約を外す
alter table public.market_place_schedule_rules drop constraint if exists market_place_schedule_rules_starts_on_check;
alter table public.market_place_schedule_rules drop constraint if exists market_place_schedule_rules_check;
alter table public.market_place_schedule_rules drop constraint if exists market_place_schedule_rules_check1;
alter table public.market_place_schedule_overrides drop constraint if exists market_place_schedule_overrides_market_date_check;

-- 残す制約: 終了日は開始日以降、周期の形（週・隔週・月）。曜日は上のトリガーで見る。
alter table public.market_place_schedule_rules
  add constraint market_place_schedule_rules_ends_after_start_check
  check (ends_on is null or ends_on >= starts_on);

alter table public.market_place_schedule_rules
  add constraint market_place_schedule_rules_shape_check
  check (
    (cadence = 'weekly' and anchor_on is null and month_weeks is null)
    or (cadence = 'fortnightly' and anchor_on is not null and month_weeks is null)
    or (cadence = 'monthly' and anchor_on is null and month_weeks is not null
      and cardinality(month_weeks) between 1 and 5
      and array_position(month_weeks, null) is null
      and month_weeks <@ array[1,2,3,4,5]::smallint[])
  );

create trigger market_place_schedule_rules_weekday
  before insert or update on public.market_place_schedule_rules
  for each row execute function public.assert_market_rule_weekday();

create trigger market_place_schedule_overrides_weekday
  before insert or update on public.market_place_schedule_overrides
  for each row execute function public.assert_market_override_weekday();

-- 既存の関数（書き込みの入口）を、日曜固定ではなく市の曜日で判定するよう置き換える。
-- 本体は直前のマイグレーションの定義のまま。日曜の判定だけを市の曜日の判定に変えた。
CREATE OR REPLACE FUNCTION public.set_market_place_override(p_location uuid, p_date date, p_membership uuid, p_action text, p_expected bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_current bigint;
begin
  if p_location is null or p_date is null or not public.market_day_matches_location(p_location, p_date) or p_action is null or p_action not in ('set','clear') then
    return jsonb_build_object('status','invalid');
  end if;
  perform 1 from public.market_locations where id = p_location for update;
  if not found then return jsonb_build_object('status','location_missing'); end if;
  select revision into v_current from public.market_place_schedule_overrides
    where location_id = p_location and market_date = p_date for update;
  if v_current is distinct from p_expected then return jsonb_build_object('status','stale'); end if;
  if p_action = 'clear' and p_membership is not null then return jsonb_build_object('status','invalid'); end if;
  -- 登録終了の更新と直列化し、確認後に終了日が変わる競合を防ぐ。
  if p_action = 'set' and p_membership is not null then
    perform 1 from public.market_place_memberships where id = p_membership for share;
  end if;
  if p_action = 'set' and p_membership is not null and not exists (
    select 1 from public.market_place_memberships m
      join public.market_place_membership_periods p on p.membership_id = m.id
    where m.id = p_membership and m.location_id = p_location
      and p.starts_on <= p_date and (p.ends_on is null or p.ends_on >= p_date)
  ) then return jsonb_build_object('status','membership_inactive'); end if;
  -- 解除も行を残し、削除後の再登録による版番号の巻き戻りを防ぐ。
  insert into public.market_place_schedule_overrides(location_id,market_date,membership_id,updated_at,is_cleared)
    values (p_location,p_date,p_membership,clock_timestamp(),p_action = 'clear')
    on conflict (location_id,market_date) do update set membership_id = excluded.membership_id, updated_at = excluded.updated_at,
      revision = public.market_place_schedule_overrides.revision + 1, is_cleared = excluded.is_cleared;
  return jsonb_build_object('status','ok');
end $function$
;
CREATE OR REPLACE FUNCTION public.end_market_schedule_rule(p_rule uuid, p_end date, p_expected_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_start date; v_end date;
begin
  if p_rule is null or p_end is null or not public.market_day_matches_location((select m.location_id from public.market_place_schedule_rules r join public.market_place_memberships m on m.id = r.membership_id where r.id = p_rule), p_end) then return jsonb_build_object('status','invalid'); end if;
  select starts_on, ends_on into v_start, v_end from public.market_place_schedule_rules where id = p_rule and voided_at is null for update;
  if not found then return jsonb_build_object('status','rule_missing'); end if;
  if v_end is distinct from p_expected_end then return jsonb_build_object('status','stale'); end if;
  if p_end < v_start then return jsonb_build_object('status','invalid'); end if;
  update public.market_place_schedule_rules set ends_on = p_end where id = p_rule;
  return jsonb_build_object('status','ok');
end $function$
;

-- 開催状況（market_days）は（市、日付）で1日1行にする。
-- 今の画面は市IDを送らないため、既定の日曜市として保存される。
-- 木曜市の状況を変える画面は市IDを送るよう、#1106 で対応する。
alter table public.market_days drop constraint if exists market_days_pkey;
alter table public.market_days add constraint market_days_pkey primary key (market_id, market_date);
