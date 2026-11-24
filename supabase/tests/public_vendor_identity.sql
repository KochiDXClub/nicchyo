-- 実 DB に変更を残さず、店舗 ID の採番と不変性を確認する。
begin;
do $$
declare v1 uuid; v2 uuid; n1 bigint; n2 bigint; changed boolean;
begin
  insert into public.vendors(shop_name) values ('テスト店1') returning id, public_shop_id into v1, n1;
  insert into public.vendors(shop_name) values ('テスト店2') returning id, public_shop_id into v2, n2;
  assert n1 >= 1000 and n2 > n1, 'new vendor IDs must be unique and outside the legacy range';
  changed := false;
  begin update public.vendors set public_shop_id = default where id = v1;
  exception when raise_exception then changed := true; end;
  assert changed, 'vendor public identity must not be mutable';
end $$;
rollback;
