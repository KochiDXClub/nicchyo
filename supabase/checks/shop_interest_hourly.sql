-- shop_interest_hourly / shop_interest_daily（お店の詳細が開かれた回数、#1069 PR-2）の権限と集計を確かめる。
--   - anon は表も view も読めず、authenticated は表に書けない（insert / update / delete）
--   - anon / authenticated は increment_shop_interest を実行できない
--   - お店の分析の権限があるメンバー（と代表者）は、自店の行だけを表と view の両方で読める
--   - 権限の無いメンバー・別の店舗の人には 0 行
--   - 同じ時間に 2 回数えると 2。同じ日の 2 つの時間は、view で流入元ごとに足し上げられる
--   - 日と時は日本時間: 土曜 23:30 UTC は日曜の day（8 時）に入る
-- 作った行はすべて rollback で消える。
--
-- 使い方（CI の Migrations Check で実行している）:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/checks/shop_interest_hourly.sql

begin;

insert into auth.users (id, email) values
 ('ee100001-0000-4000-8000-000000000001', 'interest-owner-a@example.invalid'),
 ('ee100001-0000-4000-8000-000000000002', 'interest-analyst-a@example.invalid'),
 ('ee100001-0000-4000-8000-000000000003', 'interest-member-a@example.invalid'),
 ('ee100001-0000-4000-8000-000000000004', 'interest-owner-b@example.invalid');
insert into public.vendors (id, shop_name) values
 ('ee100002-0000-4000-8000-00000000000a', 'Interest fixture A'),
 ('ee100002-0000-4000-8000-00000000000b', 'Interest fixture B');
insert into public.shop_members (vendor_id, user_id, role, permissions) values
 ('ee100002-0000-4000-8000-00000000000a', 'ee100001-0000-4000-8000-000000000001', 'owner', '{}'),
 ('ee100002-0000-4000-8000-00000000000a', 'ee100001-0000-4000-8000-000000000002', 'member', '{analytics}'),
 ('ee100002-0000-4000-8000-00000000000a', 'ee100001-0000-4000-8000-000000000003', 'member', '{post}'),
 ('ee100002-0000-4000-8000-00000000000b', 'ee100001-0000-4000-8000-000000000004', 'owner', '{}');

-- ── anon / authenticated: 読めない・書けない・呼べない ──────────────────
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    execute format('set local role %I', r);
    begin
      perform public.increment_shop_interest('ee100002-0000-4000-8000-00000000000a', 'map');
      raise exception '% could execute increment_shop_interest', r;
    exception when insufficient_privilege then null; end;
    begin
      perform public.increment_shop_interest('ee100002-0000-4000-8000-00000000000a', 'map', now());
      raise exception '% could execute increment_shop_interest with p_at', r;
    exception when insufficient_privilege then null; end;
    begin
      insert into public.shop_interest_hourly (day, hour, vendor_id, source, count)
      values (current_date, 0, 'ee100002-0000-4000-8000-00000000000a', 'map', 1);
      raise exception '% could insert into shop_interest_hourly', r;
    exception when insufficient_privilege then null; end;
    begin
      update public.shop_interest_hourly set count = count + 1;
      raise exception '% could update shop_interest_hourly', r;
    exception when insufficient_privilege then null; end;
    begin
      delete from public.shop_interest_hourly;
      raise exception '% could delete from shop_interest_hourly', r;
    exception when insufficient_privilege then null; end;
    reset role;
  end loop;

  set local role anon;
  begin
    perform 1 from public.shop_interest_hourly;
    raise exception 'anon could select shop_interest_hourly';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.shop_interest_daily;
    raise exception 'anon could select shop_interest_daily';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;

-- ── service_role: 数える ──────────────────────────────────────────────
-- 2026-11-21 は土曜。23:30 UTC = 2026-11-22（日）08:30 JST
set local role service_role;
select public.increment_shop_interest('ee100002-0000-4000-8000-00000000000a', 'map', '2026-11-21 23:30:00+00');
select public.increment_shop_interest('ee100002-0000-4000-8000-00000000000a', 'map', '2026-11-21 23:45:00+00');
select public.increment_shop_interest('ee100002-0000-4000-8000-00000000000a', 'search', '2026-11-21 23:40:00+00');
-- 同じ日の別の時間（12:00 JST）
select public.increment_shop_interest('ee100002-0000-4000-8000-00000000000a', 'map', '2026-11-22 03:00:00+00');
select public.increment_shop_interest('ee100002-0000-4000-8000-00000000000b', 'direct', '2026-11-22 01:00:00+00');
-- p_at を省いた呼び出し（API と同じ形）も数える
select public.increment_shop_interest('ee100002-0000-4000-8000-00000000000b', 'direct');

do $$
declare
  a constant uuid := 'ee100002-0000-4000-8000-00000000000a';
  b constant uuid := 'ee100002-0000-4000-8000-00000000000b';
  n integer;
begin
  -- JST の境目: 土曜 23:30 UTC は日曜の day、8 時
  if (select extract(isodow from day) from public.shop_interest_hourly
      where vendor_id = a and source = 'map' and hour = 8) is distinct from 7::numeric then
    raise exception 'Saturday 23:30 UTC should land on Sunday (JST)';
  end if;
  if exists (select 1 from public.shop_interest_hourly where vendor_id = a and day <> date '2026-11-22') then
    raise exception 'all fixture views of A should be on 2026-11-22 (JST)';
  end if;

  select count into n from public.shop_interest_hourly
  where day = '2026-11-22' and hour = 8 and vendor_id = a and source = 'map';
  if n is distinct from 2 then
    raise exception 'two increments in the same hour should count 2, got %', n;
  end if;

  select count into n from public.shop_interest_hourly
  where day = '2026-11-22' and hour = 12 and vendor_id = a and source = 'map';
  if n is distinct from 1 then
    raise exception '12:00 JST hour should count 1, got %', n;
  end if;

  -- view は日ごと・流入元ごとに足し上げる
  select count into n from public.shop_interest_daily where day = '2026-11-22' and vendor_id = a and source = 'map';
  if n is distinct from 3 then
    raise exception 'daily view should sum two hours of map to 3, got %', n;
  end if;
  select count into n from public.shop_interest_daily where day = '2026-11-22' and vendor_id = a and source = 'search';
  if n is distinct from 1 then
    raise exception 'daily view search should be 1, got %', n;
  end if;

  -- p_at を省くと今の日本時間
  if not exists (
    select 1 from public.shop_interest_hourly
    where vendor_id = b and day = (now() at time zone 'Asia/Tokyo')::date
      and hour = extract(hour from (now() at time zone 'Asia/Tokyo'))
  ) then
    raise exception 'default p_at should use the current JST day and hour';
  end if;

  -- 流入元の制約は表で断られる
  begin
    perform public.increment_shop_interest(a, 'twitter');
    raise exception 'unknown source was accepted';
  exception when check_violation then null; end;
end $$;
reset role;

-- ── authenticated: 自店の行だけ ────────────────────────────────────────
-- お店の分析の権限があるメンバー（A）
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ee100001-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.shop_interest_hourly) <> 3
     or exists (select 1 from public.shop_interest_hourly where vendor_id <> 'ee100002-0000-4000-8000-00000000000a') then
    raise exception 'analytics member of A should see exactly A''s 3 hourly rows';
  end if;
  if (select count(*) from public.shop_interest_daily) <> 2
     or exists (select 1 from public.shop_interest_daily where vendor_id <> 'ee100002-0000-4000-8000-00000000000a') then
    raise exception 'analytics member of A should see exactly A''s 2 daily rows';
  end if;
end $$;
reset role;

-- 代表者（A）は permissions が空でも読める
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ee100001-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.shop_interest_hourly) <> 3 or (select count(*) from public.shop_interest_daily) <> 2 then
    raise exception 'owner of A should see A''s rows';
  end if;
end $$;
reset role;

-- お店の分析の権限が無いメンバー（A）は 0
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ee100001-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from public.shop_interest_hourly) or exists (select 1 from public.shop_interest_daily) then
    raise exception 'member without analytics should see 0 rows';
  end if;
end $$;
reset role;

-- 別の店舗（B）の代表者には A の行は 0（自店 B の行だけ）
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ee100001-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from public.shop_interest_hourly where vendor_id = 'ee100002-0000-4000-8000-00000000000a')
     or exists (select 1 from public.shop_interest_daily where vendor_id = 'ee100002-0000-4000-8000-00000000000a') then
    raise exception 'another vendor should see 0 of A''s rows';
  end if;
  if not exists (select 1 from public.shop_interest_hourly where vendor_id = 'ee100002-0000-4000-8000-00000000000b')
     or exists (select 1 from public.shop_interest_hourly where vendor_id <> 'ee100002-0000-4000-8000-00000000000b')
     or exists (select 1 from public.shop_interest_daily where vendor_id <> 'ee100002-0000-4000-8000-00000000000b') then
    raise exception 'owner of B should see only B''s rows';
  end if;
end $$;
reset role;

rollback;
