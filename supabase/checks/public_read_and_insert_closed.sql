-- 来訪者（anon）・ログイン済みの一般ユーザーから、次のことができないことを確かめる。
--   - 掲載許可のない店舗に紐づく行を、公開 SELECT ポリシー（using (true) など）で読む
--   - reports / inquiries に直接 INSERT する（書き込みは service_role の API 経由のみ）
--   - track_home_visit を直接呼んで来訪者統計を書き換える
-- あわせて、vendor_contents が 31 日窓（期限切れの近況も読める）であることを確かめる。
--
-- 使い方（CI の Migrations Check で実行している）:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/checks/public_read_and_insert_closed.sql

do $$
declare
  bad text;
begin
  -- 店舗に紐づく公開テーブルに、条件なし（true）の SELECT ポリシーを anon / authenticated / public へ向けて残さない
  select string_agg(format('%s.%s "%s"', schemaname, tablename, policyname), E'\n  ' order by tablename, policyname)
    into bad
  from pg_policies
  where schemaname = 'public'
    and tablename in ('vendor_contents', 'product_sales', 'vendor_weekly_status', 'products', 'location_assignments')
    and cmd in ('SELECT', 'ALL')
    and permissive = 'PERMISSIVE'
    and (roles && array['public', 'anon', 'authenticated']::name[])
    and coalesce(qual, 'true') = 'true';
  if bad is not null then
    raise exception E'掲載許可のフィルタを迂回する公開 SELECT ポリシーが残っています:\n  %', bad;
  end if;

  -- 掲載許可のフィルタ（vendors で読める店舗だけ）が、公開の 3 テーブルに掛かっている
  select string_agg(t.tablename, ', ')
    into bad
  from (values ('vendor_contents'), ('vendor_weekly_status'), ('product_sales')) as t(tablename)
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = t.tablename
      and p.cmd = 'SELECT' and p.permissive = 'PERMISSIVE'
      and (p.roles && array['public', 'anon']::name[])
      and p.qual ~ 'FROM (public\.)?vendors'
  );
  if bad is not null then
    raise exception '公開 SELECT に「vendors で読める店舗だけ」の条件が無いテーブル: %', bad;
  end if;

  -- vendor_contents は 31 日窓（expires_at では絞らない。20260713000001）
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'vendor_contents'
      and policyname = 'public can read active contents'
      and qual like '%31 days%' and qual not like '%expires_at%'
  ) then
    raise exception 'vendor_contents の公開 SELECT が 31 日窓になっていません（expires_at で絞ると期限切れの近況が消える）';
  end if;

  -- reports / inquiries は anon / authenticated から直接 INSERT できない
  select string_agg(format('%s.%s', r.role_name, t.tablename), ', ')
    into bad
  from (values ('anon'), ('authenticated')) as r(role_name)
  cross join (values ('reports'), ('inquiries')) as t(tablename)
  where has_table_privilege(r.role_name, format('public.%I', t.tablename), 'INSERT');
  if bad is not null then
    raise exception 'reports / inquiries に直接 INSERT できる権限が残っています: %', bad;
  end if;

  select string_agg(format('%s "%s"', tablename, policyname), ', ')
    into bad
  from pg_policies
  where schemaname = 'public'
    and tablename in ('reports', 'inquiries')
    and cmd in ('INSERT', 'ALL')
    and (roles && array['public', 'anon', 'authenticated']::name[]);
  if bad is not null then
    raise exception 'reports / inquiries に誰でも INSERT できるポリシーが残っています: %', bad;
  end if;

  -- track_home_visit は anon / authenticated から実行できない
  if has_function_privilege('anon', 'public.track_home_visit(date, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.track_home_visit(date, text)', 'EXECUTE') then
    raise exception 'track_home_visit が anon / authenticated から実行できる状態です';
  end if;
end;
$$;
