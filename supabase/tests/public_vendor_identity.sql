-- 実 DB に変更を残さず、採番と旧番号の不変性を確認する。
begin;
do $$
declare v1 uuid; v2 uuid; loc uuid; n1 bigint; n2 bigint; changed boolean;
begin
  insert into public.vendors default values returning id, public_shop_id into v1, n1;
  insert into public.vendors default values returning id, public_shop_id into v2, n2;
  assert n1 >= 1000 and n2 > n1, 'new vendor IDs must be unique and outside legacy range';
  changed := false;
  begin update public.vendors set public_shop_id = default where id = v1;
  exception when raise_exception then changed := true; end;
  assert changed, 'vendor public identity must not be mutable';
  insert into public.market_locations(store_number) values (17) returning id into loc;
  insert into public.location_assignments(location_id, vendor_id) values (loc, v1), (loc, v2), (loc, v2);
  assert (select candidate_count = 2 from public.legacy_shop_identity_candidates where legacy_shop_id = 17), 'candidate history must retain ambiguity';
  assert not has_table_privilege('anon', 'public.legacy_shop_identity_candidates', 'select'), 'candidate history is private';
  insert into public.legacy_shop_identity_aliases(legacy_shop_id, vendor_id, confirmed_by, evidence)
    values (1, v1, gen_random_uuid(), 'operator verified');
  changed := false;
  begin update public.legacy_shop_identity_aliases set vendor_id = v2 where legacy_shop_id = 1;
  exception when raise_exception then changed := true; end;
  assert changed, 'legacy link must not be reassigned';
  changed := false;
  begin delete from public.legacy_shop_identity_aliases where legacy_shop_id = 1;
  exception when raise_exception then changed := true; end;
  assert changed, 'legacy link must not be deleted and reused';
  delete from public.vendors where id = v1;
  assert (select vendor_id is null from public.legacy_shop_identity_aliases where legacy_shop_id = 1), 'deletion preserves tombstone';
end $$;
rollback;
