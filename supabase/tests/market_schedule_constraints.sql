begin;
insert into market_locations(id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into vendors(id) values ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002');
insert into market_place_memberships(id,location_id,vendor_id,vendor_number) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',1),
 ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',2);
insert into market_place_schedule_rules(membership_id,cadence,starts_on,anchor_on) values ('20000000-0000-0000-0000-000000000001','fortnightly','2026-11-01','2026-11-01');
insert into market_place_schedule_rules(membership_id,cadence,starts_on,month_weeks) values ('20000000-0000-0000-0000-000000000003','monthly','2026-11-01',array[1,3]::smallint[]);
insert into market_place_schedule_overrides(location_id,market_date,membership_id) values ('00000000-0000-0000-0000-000000000001','2026-11-08',null);
do $$ begin
  begin insert into market_place_memberships(location_id,vendor_id,vendor_number) values ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',1); raise exception 'duplicate number allowed'; exception when unique_violation then null; end;
  begin insert into market_place_schedule_overrides(location_id,market_date,membership_id) values ('00000000-0000-0000-0000-000000000002','2026-11-08','20000000-0000-0000-0000-000000000001'); raise exception 'cross-place override allowed'; exception when foreign_key_violation then null; end;
  begin insert into market_place_schedule_rules(membership_id,cadence,starts_on,month_weeks) values ('20000000-0000-0000-0000-000000000001','monthly','2026-11-01',array[6]::smallint[]); raise exception 'invalid week allowed'; exception when check_violation then null; end;
  if has_table_privilege('anon','public.market_place_schedule_rules','select') then raise exception 'anon can read'; end if;
  if not has_table_privilege('service_role','public.market_place_schedule_rules','insert') then raise exception 'service_role cannot write'; end if;
end $$;
rollback;
