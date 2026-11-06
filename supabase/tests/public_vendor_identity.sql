-- 実 DB に変更を残さず、採番と旧番号の不変性を確認する。
begin;
do $$
declare v1 uuid; v2 uuid; loc uuid; test_number integer; n1 bigint; n2 bigint; changed boolean;
begin
  insert into public.vendors(shop_name) values ('テスト店1') returning id, public_shop_id into v1, n1;
  insert into public.vendors(shop_name) values ('テスト店2') returning id, public_shop_id into v2, n2;
  assert n1 >= 1000 and n2 > n1, 'new vendor IDs must be unique and outside legacy range';
  changed := false;
  begin update public.vendors set public_shop_id = default where id = v1;
  exception when raise_exception then changed := true; end;
  assert changed, 'vendor public identity must not be mutable';
  select n into test_number from generate_series(1,999) n where not exists (select 1 from public.market_locations where store_number = n) and not exists (select 1 from public.legacy_shop_identity_aliases where legacy_shop_id = n) limit 1;
  assert test_number is not null, 'a free legacy number is required for this test';
  insert into public.market_locations(store_number,latitude,longitude) values (test_number,33.56,133.53) returning id into loc;
  insert into public.location_assignments(location_id, vendor_id, market_date) values (loc, v1, '2026-11-01'), (loc, v2, '2026-11-08'), (loc, v2, '2026-11-15');
  assert (select candidate_count = 2 from public.legacy_shop_identity_candidates where legacy_shop_id = test_number), 'candidate history must retain ambiguity';
  assert not has_table_privilege('anon', 'public.legacy_shop_identity_candidates', 'select'), 'candidate history is private';
  changed := false;
  begin insert into public.legacy_shop_identity_aliases(legacy_shop_id, vendor_id, confirmed_by, evidence) values (test_number, null, gen_random_uuid(), 'invalid');
  exception when raise_exception then changed := true; end;
  assert changed, 'null vendor must not reserve a legacy number';
  insert into public.legacy_shop_identity_aliases(legacy_shop_id, vendor_id, confirmed_by, evidence)
    values (test_number, v1, gen_random_uuid(), 'operator verified');
  changed := false;
  begin update public.legacy_shop_identity_aliases set vendor_id = v2 where legacy_shop_id = test_number;
  exception when raise_exception then changed := true; end;
  assert changed, 'legacy link must not be reassigned';
  changed := false;
  begin delete from public.legacy_shop_identity_aliases where legacy_shop_id = test_number;
  exception when raise_exception then changed := true; end;
  assert changed, 'legacy link must not be deleted and reused';
  delete from public.vendors where id = v1;
  assert (select vendor_id is null from public.legacy_shop_identity_aliases where legacy_shop_id = test_number), 'deletion preserves tombstone';
end $$;
rollback;
