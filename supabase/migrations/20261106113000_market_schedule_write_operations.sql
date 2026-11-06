-- 管理画面の書き込みをDB内で直列化し、確認前には登録・採番を行わない。
-- 繰り返しは登録期間に結びつける。出店終了後の再開時に旧ルールを自動復活させない。
do $$ begin
  if exists (select 1 from public.market_place_schedule_rules) then raise exception 'market_schedule_rule_period_backfill_required'; end if;
end $$;
alter table public.market_place_schedule_rules add column period_id uuid not null;
alter table public.market_place_schedule_rules add column voided_at timestamptz;
alter table public.market_place_schedule_rules add constraint market_schedule_rule_period_fkey
  foreign key (period_id, membership_id) references public.market_place_membership_periods(id, membership_id) on delete restrict;

create function public.add_market_place_membership(p_location uuid, p_vendor uuid, p_start date, p_confirm boolean, p_seen_count integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_count integer; v_number integer;
begin
  if p_location is null or p_vendor is null or p_start is null then return jsonb_build_object('status','invalid'); end if;
  perform 1 from public.market_locations where id = p_location for update;
  if not found then return jsonb_build_object('status','location_missing'); end if;
  perform 1 from public.vendors where id = p_vendor for share;
  if not found then return jsonb_build_object('status','vendor_missing'); end if;
  select id, vendor_number into v_id, v_number from public.market_place_memberships
    where location_id = p_location and vendor_id = p_vendor for update;
  if v_id is not null and exists (
    select 1 from public.market_place_membership_periods where membership_id = v_id
      and (ends_on is null or ends_on >= p_start)
  ) then return jsonb_build_object('status','period_overlap'); end if;
  -- 引き継ぎや臨時出店も含め、終了済みの店舗がある場所でも登録前に知らせる。
  select count(*) into v_count from public.market_place_memberships m
    where m.location_id = p_location and m.vendor_id <> p_vendor;
  if v_id is not null then v_count := 0; end if;
  if v_count > 0 and not coalesce(p_confirm, false) then
    return jsonb_build_object('status','confirmation_required','count',v_count);
  end if;
  if v_count > 0 and p_seen_count is distinct from v_count then
    return jsonb_build_object('status','stale_confirmation','count',v_count);
  end if;
  if v_id is null then
    insert into public.market_place_memberships(location_id,vendor_id) values (p_location,p_vendor)
      returning id,vendor_number into v_id,v_number;
  end if;
  insert into public.market_place_membership_periods(membership_id, starts_on) values (v_id,p_start);
  return jsonb_build_object('status','ok','membershipId',v_id,'vendorNumber',v_number);
end $$;
revoke all on function public.add_market_place_membership(uuid,uuid,date,boolean,integer) from public, anon, authenticated;
grant execute on function public.add_market_place_membership(uuid,uuid,date,boolean,integer) to service_role;

-- 日付ごとの例外は、閲覧時と現在の更新時刻が違えば上書きしない。
alter table public.market_place_schedule_overrides add column updated_at timestamptz not null default clock_timestamp();
alter table public.market_place_schedule_overrides add column revision bigint not null default 1 check (revision > 0);
alter table public.market_place_schedule_overrides add column is_cleared boolean not null default false;
alter table public.market_place_schedule_overrides add constraint cleared_override_has_no_membership check (not is_cleared or membership_id is null);
create function public.set_market_place_override(p_location uuid, p_date date, p_membership uuid, p_action text, p_expected bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_current bigint;
begin
  if p_location is null or p_date is null or extract(dow from p_date) <> 0 or p_action is null or p_action not in ('set','clear') then
    return jsonb_build_object('status','invalid');
  end if;
  perform 1 from public.market_locations where id = p_location for update;
  if not found then return jsonb_build_object('status','location_missing'); end if;
  select revision into v_current from public.market_place_schedule_overrides
    where location_id = p_location and market_date = p_date for update;
  if v_current is distinct from p_expected then return jsonb_build_object('status','stale'); end if;
  if p_action = 'clear' and p_membership is not null then return jsonb_build_object('status','invalid'); end if;
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
end $$;
revoke all on function public.set_market_place_override(uuid,date,uuid,text,bigint) from public, anon, authenticated;
grant execute on function public.set_market_place_override(uuid,date,uuid,text,bigint) to service_role;

create function public.end_market_place_membership(p_membership uuid, p_end date, p_expected_start date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_start date; v_period uuid;
begin
  if p_membership is null or p_end is null or p_expected_start is null then return jsonb_build_object('status','invalid'); end if;
  perform 1 from public.market_place_memberships where id = p_membership for update;
  if not found then return jsonb_build_object('status','membership_missing'); end if;
  select id, starts_on into v_period, v_start from public.market_place_membership_periods
    where membership_id = p_membership and ends_on is null for update;
  if v_period is null or v_start is distinct from p_expected_start then return jsonb_build_object('status','stale'); end if;
  if p_end < v_start then return jsonb_build_object('status','invalid'); end if;
  update public.market_place_membership_periods set ends_on = p_end where id = v_period;
  return jsonb_build_object('status','ok');
end $$;
revoke all on function public.end_market_place_membership(uuid,date,date) from public, anon, authenticated;
grant execute on function public.end_market_place_membership(uuid,date,date) to service_role;

create function public.add_market_schedule_rule(p_membership uuid, p_cadence text, p_start date, p_end date, p_anchor date, p_weeks smallint[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_period uuid;
begin
  if p_membership is null or p_start is null then return jsonb_build_object('status','invalid'); end if;
  perform 1 from public.market_place_memberships where id = p_membership for update;
  if not found then return jsonb_build_object('status','membership_missing'); end if;
  select p.id into v_period from public.market_place_membership_periods p where p.membership_id = p_membership
    and p.starts_on <= p_start and (p.ends_on is null or p.ends_on >= p_start) for share;
  if v_period is null then
    return jsonb_build_object('status','membership_inactive');
  end if;
  begin
    insert into public.market_place_schedule_rules(membership_id,period_id,cadence,starts_on,ends_on,anchor_on,month_weeks)
      values (p_membership,v_period,p_cadence,p_start,p_end,p_anchor,p_weeks) returning id into v_id;
  exception when check_violation or not_null_violation then return jsonb_build_object('status','invalid'); end;
  return jsonb_build_object('status','ok','ruleId',v_id);
end $$;
revoke all on function public.add_market_schedule_rule(uuid,text,date,date,date,smallint[]) from public, anon, authenticated;
grant execute on function public.add_market_schedule_rule(uuid,text,date,date,date,smallint[]) to service_role;

-- 過去の予定を消さず、終了日を追加する。編集時の値が変わっていれば上書きしない。
create function public.end_market_schedule_rule(p_rule uuid, p_end date, p_expected_end date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_start date; v_end date;
begin
  if p_rule is null or p_end is null or extract(dow from p_end) <> 0 then return jsonb_build_object('status','invalid'); end if;
  select starts_on, ends_on into v_start, v_end from public.market_place_schedule_rules where id = p_rule and voided_at is null for update;
  if not found then return jsonb_build_object('status','rule_missing'); end if;
  if v_end is distinct from p_expected_end then return jsonb_build_object('status','stale'); end if;
  if p_end < v_start then return jsonb_build_object('status','invalid'); end if;
  update public.market_place_schedule_rules set ends_on = p_end where id = p_rule;
  return jsonb_build_object('status','ok');
end $$;
revoke all on function public.end_market_schedule_rule(uuid,date,date) from public, anon, authenticated;
grant execute on function public.end_market_schedule_rule(uuid,date,date) to service_role;

-- 誤登録の取消は行を消さず、監査可能な状態で残す。
create function public.void_market_schedule_rule(p_rule uuid, p_expected_end date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_end date; v_voided timestamptz;
begin
  if p_rule is null then return jsonb_build_object('status','invalid'); end if;
  select ends_on, voided_at into v_end, v_voided from public.market_place_schedule_rules where id = p_rule for update;
  if not found then return jsonb_build_object('status','rule_missing'); end if;
  if v_voided is not null or v_end is distinct from p_expected_end then return jsonb_build_object('status','stale'); end if;
  update public.market_place_schedule_rules set voided_at = clock_timestamp() where id = p_rule;
  return jsonb_build_object('status','ok');
end $$;
revoke all on function public.void_market_schedule_rule(uuid,date) from public, anon, authenticated;
grant execute on function public.void_market_schedule_rule(uuid,date) to service_role;
