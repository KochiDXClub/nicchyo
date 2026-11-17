-- search_term_daily（検索語の日次件数、#1069 PR-1）の権限と集計を確かめる。
--   - anon / authenticated は、表も view も読めず、2 つの関数も実行できない
--   - 同じ日に同じ語を 2 回数えると count が 2（日付は日本時間）
--   - term が NULL の行は、日ごとに 1 行へ集約される
--   - 語の長さの制約（2〜100 文字）が効く
--   - view は、NULL の匿名行と、件数が基準（analytics_publish_min_count）に届かない語を出さない
--     （基準の設定が 0・負数・巨大な値でも、1 件だけの語は出ず、view は読める）
-- 作った行はすべて rollback で消える。
--
-- 使い方（CI の Migrations Check で実行している）:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/checks/search_term_daily.sql

begin;

-- 開発 DB に基準の設定が残っていても、既定値（10）の確認ができるよう、このトランザクションの中だけ消す
delete from public.system_settings where key = 'analytics_publish_min_count';
delete from public.search_term_daily;

do $$ begin
  if public.analytics_publish_min_count() <> 10 then
    raise exception 'analytics_publish_min_count default should be 10';
  end if;
end $$;

-- anon / authenticated: 表・view・関数のどれにも触れない
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    execute format('set local role %I', r);
    begin
      perform 1 from public.search_term_daily;
      raise exception '% could select search_term_daily', r;
    exception when insufficient_privilege then null; end;
    begin
      perform 1 from public.search_term_daily_public;
      raise exception '% could select search_term_daily_public', r;
    exception when insufficient_privilege then null; end;
    begin
      perform public.increment_search_term_daily('security-fixture');
      raise exception '% could execute increment_search_term_daily', r;
    exception when insufficient_privilege then null; end;
    begin
      perform public.analytics_publish_min_count();
      raise exception '% could execute analytics_publish_min_count', r;
    exception when insufficient_privilege then null; end;
    reset role;
  end loop;
end $$;

-- service_role: 数える
set local role service_role;

select public.increment_search_term_daily('みかん');
select public.increment_search_term_daily('みかん');
select public.increment_search_term_daily(null);
select public.increment_search_term_daily(null);
select public.increment_search_term_daily(null);

do $$
declare
  jst_today date := (now() at time zone 'Asia/Tokyo')::date;
  n integer;
begin
  select count into n from public.search_term_daily where term = 'みかん';
  if n is distinct from 2 then
    raise exception 'same term twice should count 2, got %', n;
  end if;

  if (select day from public.search_term_daily where term = 'みかん') <> jst_today then
    raise exception 'day should be the JST date';
  end if;

  if (select count(*) from public.search_term_daily where term is null) <> 1 then
    raise exception 'NULL terms should aggregate into one row per day';
  end if;
  select count into n from public.search_term_daily where term is null;
  if n <> 3 then
    raise exception 'NULL term row should count 3, got %', n;
  end if;

  -- 語の長さ（1 文字・101 文字）は表の制約で断られる
  begin
    perform public.increment_search_term_daily('あ');
    raise exception '1-character term was accepted';
  exception when check_violation then null; end;
  begin
    perform public.increment_search_term_daily(repeat('あ', 101));
    raise exception '101-character term was accepted';
  exception when check_violation then null; end;

  -- 基準（既定 10）に届かない語、NULL の匿名行は view に出ない
  if exists (select 1 from public.search_term_daily_public) then
    raise exception 'view should be empty below the publish threshold';
  end if;
end $$;

reset role;

-- 基準を下げると、届いた語だけが出る（NULL の匿名行は件数が多くても出ない）
insert into public.system_settings (key, value) values ('analytics_publish_min_count', '2'::jsonb);

set local role service_role;
do $$ begin
  if (select array_agg(term) from public.search_term_daily_public) is distinct from array['みかん'] then
    raise exception 'view should show only the term that reached the threshold';
  end if;
end $$;
reset role;

-- 設定が 0・負数・巨大な値でも、1 件だけの語は出ず、view も読める（基準は 2〜100000 に収まる）
set local role service_role;
select public.increment_search_term_daily('ゆず');
reset role;

do $$
declare
  v text;
begin
  foreach v in array array['0', '-5', '1', '99999999999999'] loop
    update public.system_settings set value = v::jsonb where key = 'analytics_publish_min_count';
    set local role service_role;
    if exists (select 1 from public.search_term_daily_public where term = 'ゆず') then
      raise exception 'term counted once should stay hidden when the setting is %', v;
    end if;
    reset role;
  end loop;
end $$;

rollback;
