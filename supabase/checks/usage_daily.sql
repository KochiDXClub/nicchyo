-- usage_daily（機能の利用回数の日次件数、#1069 PR-3）の権限と集計を確かめる。
--   - anon / authenticated は、表を読めず・直接書けず、関数も実行できない
--   - 同じ日に同じ機能を 2 回数えると count が 2（日付は日本時間、area は 'unknown'）
--   - 機能の値は 4 つ（map / consult / search / shop）に限られる
--   - area は domain analytics_area の値（'1'〜'7' / 'outside' / 'unknown'）に限られる
-- 作った行はすべて rollback で消える。
--
-- 使い方（CI の Migrations Check で実行している）:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/checks/usage_daily.sql

begin;

delete from public.usage_daily;

-- anon / authenticated: 表・関数のどちらにも触れない
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    execute format('set local role %I', r);
    begin
      perform 1 from public.usage_daily;
      raise exception '% could select usage_daily', r;
    exception when insufficient_privilege then null; end;
    begin
      insert into public.usage_daily (day, feature) values (current_date, 'map');
      raise exception '% could insert into usage_daily', r;
    exception when insufficient_privilege then null; end;
    begin
      perform public.increment_usage_daily('map');
      raise exception '% could execute increment_usage_daily', r;
    exception when insufficient_privilege then null; end;
    reset role;
  end loop;
end $$;

-- service_role: 数える
set local role service_role;

select public.increment_usage_daily('map');
select public.increment_usage_daily('map');
select public.increment_usage_daily('consult');

do $$
declare
  jst_today date := (now() at time zone 'Asia/Tokyo')::date;
  n integer;
begin
  select count into n from public.usage_daily where feature = 'map';
  if n is distinct from 2 then
    raise exception 'same feature twice should count 2, got %', n;
  end if;

  if exists (select 1 from public.usage_daily where day <> jst_today or area <> 'unknown') then
    raise exception 'rows should be on the JST date with area unknown';
  end if;

  if (select count(*) from public.usage_daily) <> 2 then
    raise exception 'expected one row per feature';
  end if;

  -- 4 つ以外の機能は表の制約で断られる
  begin
    perform public.increment_usage_daily('admin');
    raise exception 'unknown feature was accepted';
  exception when check_violation then null; end;
end $$;

reset role;

-- area は domain の値だけ（丁目は 1〜7）
do $$ begin
  begin
    insert into public.usage_daily (day, feature, area) values (current_date, 'map', '8');
    raise exception 'area 8 was accepted';
  exception when check_violation then null; end;
  begin
    insert into public.usage_daily (day, feature, area) values (current_date, 'map', 'kochi');
    raise exception 'area kochi was accepted';
  exception when check_violation then null; end;
  insert into public.usage_daily (day, feature, area) values (current_date, 'map', '7');
  insert into public.usage_daily (day, feature, area) values (current_date, 'map', 'outside');
end $$;

rollback;
