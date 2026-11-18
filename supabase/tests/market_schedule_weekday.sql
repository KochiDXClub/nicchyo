-- 開催日の曜日が市の開催曜日に従うことのテスト
-- （20261118150000_market_schedule_follows_market_weekday.sql）
-- 日曜市の場所では日曜だけ、木曜市の場所では木曜だけ予定と例外が通ることを確かめる。
-- 最後に rollback するので本番データは変わらない。
begin;

insert into public.market_locations(id, store_number, latitude, longitude, market_id)
values
  ('00000000-0000-0000-0000-00000000a001', 99201, 33.56, 133.53, (select id from public.markets where slug = 'nichiyo')),
  ('00000000-0000-0000-0000-00000000a002', 99202, 33.56, 133.54, (select id from public.markets where slug = 'mokuyo'));

insert into public.vendors(id, shop_name) values
  ('10000000-0000-0000-0000-00000000a001', '曜日テスト店1'),
  ('10000000-0000-0000-0000-00000000a002', '曜日テスト店2');

insert into public.market_place_memberships(id, location_id, vendor_id) values
  ('20000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001'),
  ('20000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a002');

insert into public.market_place_membership_periods(id, membership_id, starts_on, ends_on) values
  ('30000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-00000000a001', '2026-01-01', null),
  ('30000000-0000-0000-0000-00000000a002', '20000000-0000-0000-0000-00000000a002', '2026-01-01', null);

do $$ begin
  -- 日曜市の予定は日曜なら通る
  insert into public.market_place_schedule_rules(membership_id, period_id, cadence, starts_on)
    values ('20000000-0000-0000-0000-00000000a001', '30000000-0000-0000-0000-00000000a001', 'weekly', '2026-11-22');
  -- 日曜市の予定に木曜を入れると失敗する
  begin
    insert into public.market_place_schedule_rules(membership_id, period_id, cadence, starts_on)
      values ('20000000-0000-0000-0000-00000000a001', '30000000-0000-0000-0000-00000000a001', 'weekly', '2026-11-19');
    raise exception '日曜市に木曜の予定が入った';
  exception when check_violation then null;
  end;

  -- 木曜市の予定は木曜なら通る
  insert into public.market_place_schedule_rules(membership_id, period_id, cadence, starts_on)
    values ('20000000-0000-0000-0000-00000000a002', '30000000-0000-0000-0000-00000000a002', 'weekly', '2026-11-19');
  -- 木曜市の予定に日曜を入れると失敗する
  begin
    insert into public.market_place_schedule_rules(membership_id, period_id, cadence, starts_on)
      values ('20000000-0000-0000-0000-00000000a002', '30000000-0000-0000-0000-00000000a002', 'weekly', '2026-11-22');
    raise exception '木曜市に日曜の予定が入った';
  exception when check_violation then null;
  end;

  -- 木曜市の隔週の基準日が日曜なら失敗する（基準日も市の曜日に従う）
  begin
    insert into public.market_place_schedule_rules(membership_id, period_id, cadence, starts_on, anchor_on)
      values ('20000000-0000-0000-0000-00000000a002', '30000000-0000-0000-0000-00000000a002', 'fortnightly', '2026-11-19', '2026-11-22');
    raise exception '木曜市の基準日に日曜が入った';
  exception when check_violation then null;
  end;

  -- 例外（overrides）も同じ。木曜市は木曜の例外を通し、日曜の例外は失敗する
  insert into public.market_place_schedule_overrides(location_id, market_date)
    values ('00000000-0000-0000-0000-00000000a002', '2026-11-26');
  begin
    insert into public.market_place_schedule_overrides(location_id, market_date)
      values ('00000000-0000-0000-0000-00000000a002', '2026-11-22');
    raise exception '木曜市に日曜の例外が入った';
  exception when check_violation then null;
  end;

  -- 既存の日曜市の例外は引き続き通る
  insert into public.market_place_schedule_overrides(location_id, market_date)
    values ('00000000-0000-0000-0000-00000000a001', '2026-11-29');
end $$;

-- 木曜の日付を日曜市の場所に入れる関数は「invalid」を返す
do $$ begin
  if (public.set_market_place_override('00000000-0000-0000-0000-00000000a001', '2026-11-19', null, 'clear', 0)->>'status') <> 'invalid' then
    raise exception '日曜市の場所で木曜の例外が通った';
  end if;
end $$;

rollback;
