-- 市（markets）の土台のテスト（20261118140000_create_markets_foundation.sql）
-- 日曜市が既定の市であること、既存の行が日曜市に入ること、非公開の市が一般に見えないこと、
-- 管理者だけが市を作れることを確かめる。最後に rollback するので本番データは変わらない。
begin;

do $$ begin
  if not exists (select 1 from public.markets where slug = 'nichiyo' and weekday = 0 and is_public) then
    raise exception '日曜市の初期行がない';
  end if;
  if not exists (select 1 from public.markets where slug = 'mokuyo' and weekday = 4 and not is_public) then
    raise exception '木曜市は非公開で登録されていない';
  end if;
  -- 既存の行は日曜市に紐づく
  if exists (select 1 from public.market_days where market_id is distinct from public.default_market_id()) then
    raise exception 'market_days の既存行が日曜市に紐づいていない';
  end if;
  -- 市IDを省略して入れた行は日曜市になる（既存の画面のコードが市IDを送らないため）
  insert into public.market_days(market_date) values ('2099-01-04');
  if (select market_id from public.market_days where market_date = '2099-01-04') <> public.default_market_id() then
    raise exception '市IDを省略した行が日曜市に入らない';
  end if;
  insert into public.market_locations(id, store_number, latitude, longitude)
    values ('00000000-0000-0000-0000-00000000f001', 99901, 33.56, 133.53);
  if (select market_id from public.market_locations where id = '00000000-0000-0000-0000-00000000f001') <> public.default_market_id() then
    raise exception 'market_locations の既定値が日曜市でない';
  end if;
end $$;

-- 一般の訪問者（anon）は公開中の市だけ見られる
set local role anon;
do $$ begin
  if (select count(*) from public.markets where slug = 'mokuyo') <> 0 then
    raise exception '非公開の木曜市が一般に見えている';
  end if;
  if (select count(*) from public.markets where slug = 'nichiyo') <> 1 then
    raise exception '公開中の日曜市が見えない';
  end if;
end $$;
reset role;

-- 管理者（app_metadata.role = admin）は非公開の市を見て、公開フラグを切り替えられる
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin"}}', true);
do $$ begin
  if (select count(*) from public.markets where slug = 'mokuyo') <> 1 then
    raise exception '管理者に非公開の木曜市が見えない';
  end if;
  update public.markets set is_public = true where slug = 'mokuyo';
  if not (select is_public from public.markets where slug = 'mokuyo') then
    raise exception '管理者が公開フラグを変えられない';
  end if;
  update public.markets set is_public = false where slug = 'mokuyo';
end $$;
reset role;

-- 管理者でない利用者は市を作れない
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"member"}}', true);
do $$ begin
  begin
    insert into public.markets(slug, name, weekday) values ('kayo', '火曜市', 2);
    raise exception '管理者でない利用者が市を作れた';
  exception when insufficient_privilege or check_violation then
    null;
  end;
end $$;
reset role;

rollback;
