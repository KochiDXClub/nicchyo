begin;
insert into market_locations(id,store_number,latitude,longitude) values ('00000000-0000-0000-0000-000000000001',99001,33.56,133.53), ('00000000-0000-0000-0000-000000000002',99002,33.56,133.54);
insert into vendors(id,shop_name) values ('10000000-0000-0000-0000-000000000001','テスト店1'), ('10000000-0000-0000-0000-000000000002','テスト店2'), ('10000000-0000-0000-0000-000000000003','テスト店3');
insert into market_place_memberships(id,location_id,vendor_id) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
insert into market_place_schedule_rules(membership_id,cadence,starts_on,anchor_on) values ('20000000-0000-0000-0000-000000000001','fortnightly','2026-11-01','2026-11-01');
insert into market_place_schedule_rules(membership_id,cadence,starts_on,month_weeks) values ('20000000-0000-0000-0000-000000000003','monthly','2026-11-01',array[1,3]::smallint[]);
insert into market_place_schedule_overrides(location_id,market_date,membership_id) values ('00000000-0000-0000-0000-000000000001','2026-11-08',null);
do $$ begin
  if (select vendor_number from market_place_memberships where id = '20000000-0000-0000-0000-000000000001') <> 1 then raise exception 'first number not allocated'; end if;
  if (select vendor_number from market_place_memberships where id = '20000000-0000-0000-0000-000000000003') <> 2 then raise exception 'second number not allocated'; end if;
  update market_place_memberships set ended_at = now() where id = '20000000-0000-0000-0000-000000000001';
  insert into market_place_memberships(location_id,vendor_id) values ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003');
  if (select vendor_number from market_place_memberships where vendor_id = '10000000-0000-0000-0000-000000000003') <> 3 then raise exception 'retired number was reused'; end if;
  update market_place_memberships set ended_at = null where id = '20000000-0000-0000-0000-000000000001';
  if (select vendor_number from market_place_memberships where id = '20000000-0000-0000-0000-000000000001') <> 1 then raise exception 'reactivation changed number'; end if;
  begin insert into market_place_memberships(location_id,vendor_id,vendor_number) values ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',1); raise exception 'manual number allowed'; exception when check_violation then null; end;
  begin delete from market_place_memberships where id = '20000000-0000-0000-0000-000000000001'; raise exception 'membership delete allowed'; exception when check_violation then null; end;
  begin update market_place_memberships set vendor_number = 9 where id = '20000000-0000-0000-0000-000000000001'; raise exception 'number change allowed'; exception when check_violation then null; end;
  begin insert into market_place_schedule_overrides(location_id,market_date,membership_id) values ('00000000-0000-0000-0000-000000000002','2026-11-08','20000000-0000-0000-0000-000000000001'); raise exception 'cross-place override allowed'; exception when foreign_key_violation then null; end;
  begin insert into market_place_schedule_rules(membership_id,cadence,starts_on,month_weeks) values ('20000000-0000-0000-0000-000000000001','monthly','2026-11-01',array[6]::smallint[]); raise exception 'invalid week allowed'; exception when check_violation then null; end;
  if has_table_privilege('anon','public.market_place_schedule_rules','select') or has_table_privilege('authenticated','public.market_place_schedule_rules','select') then raise exception 'public role can read'; end if;
  if has_table_privilege('anon','public.market_place_number_counters','select,insert,update,delete') or has_table_privilege('authenticated','public.market_place_number_counters','select,insert,update,delete') or has_table_privilege('service_role','public.market_place_number_counters','select,insert,update,delete') then raise exception 'counter privileges too broad'; end if;
  if not has_table_privilege('service_role','public.market_place_schedule_rules','insert') then raise exception 'service_role cannot write'; end if;
end $$;
rollback;
