begin;
do $$
declare result jsonb; loc uuid := 'd0000000-0000-0000-0000-000000000001'; vendor uuid := 'd1000000-0000-0000-0000-000000000001'; member uuid := 'd2000000-0000-0000-0000-000000000001'; period uuid := 'd3000000-0000-0000-0000-000000000001'; actor uuid := 'd4000000-0000-0000-0000-000000000001';
begin
  if (select enabled from public.public_schedule_rollout where id) then raise exception 'rollout must default off'; end if;
  if has_table_privilege('anon','public.public_schedule_rollout','select') or has_function_privilege('authenticated','public.set_public_schedule_rollout(boolean,integer,uuid)','execute') then raise exception 'rollout controls are public'; end if;
  result := public.set_public_schedule_rollout(true, 1, actor);
  if result->>'status' <> 'no_rules' then raise exception 'empty rollout was accepted: %', result; end if;
  insert into public.market_locations(id,store_number,latitude,longitude) values (loc, 99004, 33.56, 133.53);
  insert into public.vendors(id,shop_name) values (vendor, '公開テスト');
  insert into public.market_place_memberships(id,location_id,vendor_id) values (member,loc,vendor);
  insert into public.market_place_membership_periods(id,membership_id,starts_on) values (period,member,'2026-11-01');
  -- 単発出店だけで公開する運用も認める（この副トランザクションは戻す）。
  begin
    insert into public.market_place_schedule_overrides(location_id,market_date,membership_id) values (loc,'2026-11-08',member);
    result := public.set_public_schedule_rollout(true, 1, actor);
    if result->>'status' <> 'ok' then raise exception 'single-date rollout failed: %', result; end if;
    raise exception 'rollback single-date fixture';
  exception when raise_exception then
    if sqlerrm <> 'rollback single-date fixture' then raise; end if;
  end;
  insert into public.market_place_schedule_rules(membership_id,period_id,cadence,starts_on) values (member,period,'weekly','2026-11-01');
  insert into public.legacy_shop_identity_aliases(legacy_shop_id,vendor_id,confirmed_by,evidence) values (998,vendor,actor,'確認済みの旧台帳記録です');
  insert into public.legacy_shop_identity_revocations(legacy_shop_id,revoked_by,reason) values (998,actor,'対応の誤りを確認しました');
  begin
    delete from public.legacy_shop_identity_revocations where legacy_shop_id = 998;
    raise exception 'revocation delete was accepted';
  exception when raise_exception then
    if sqlerrm <> 'legacy_shop_identity_revocation_is_immutable' then raise; end if;
  end;
  if has_table_privilege('anon','public.legacy_shop_identity_revocations','select') then raise exception 'revocation audit is public'; end if;
  result := public.set_public_schedule_rollout(true, 1, actor);
  if result->>'status' <> 'ok' or not (select enabled from public.public_schedule_rollout where id) then raise exception 'enable failed: %', result; end if;
  result := public.set_public_schedule_rollout(false, 1, actor);
  if result->>'status' <> 'stale' or not (select enabled from public.public_schedule_rollout where id) then raise exception 'stale update accepted'; end if;
  result := public.set_public_schedule_rollout(false, 2, actor);
  if result->>'status' <> 'irreversible' or not (select enabled from public.public_schedule_rollout where id) then raise exception 'unsafe rollback was accepted'; end if;
  begin update public.public_schedule_rollout set enabled = false where id; raise exception 'direct rollback was accepted';
  exception when check_violation then null; end;
end $$;
rollback;
