-- 来訪者（anon）・ログイン済みの一般ユーザーから、次のことができないことを確かめる。
--   - 掲載許可のない店舗に紐づく行を、公開 SELECT ポリシー（using (true) など）で読む
--   - reports / inquiries に直接 INSERT する（書き込みは service_role の API 経由のみ）
--   - track_home_visit を直接呼んで来訪者統計を書き換える
-- location_assignments に直接書き込めないことも確かめる（ファイル末尾）。
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
    and tablename in ('vendor_contents', 'vendor_weekly_status', 'products', 'location_assignments')
    and cmd in ('SELECT', 'ALL')
    and permissive = 'PERMISSIVE'
    and (roles && array['public', 'anon', 'authenticated']::name[])
    and coalesce(qual, 'true') = 'true';
  if bad is not null then
    raise exception E'掲載許可のフィルタを迂回する公開 SELECT ポリシーが残っています:\n  %', bad;
  end if;

  -- 掲載許可のフィルタ（vendors で読める店舗だけ）が、公開の 2 テーブル（product_sales は 20261008110000 で削除）に掛かっている
  select string_agg(t.tablename, ', ')
    into bad
  from (values ('vendor_contents'), ('vendor_weekly_status')) as t(tablename)
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

-- location_assignments（区画の割り当て）は運営だけが書く。出店者を含め anon / authenticated からは
-- INSERT / UPDATE / DELETE できない（20261008100000）
do $$
declare
  bad text;
begin
  select string_agg(format('%s:%s', r.role_name, p.priv), ', ')
    into bad
  from (values ('anon'), ('authenticated')) as r(role_name)
  cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) as p(priv)
  where has_table_privilege(r.role_name, 'public.location_assignments', p.priv);
  if bad is not null then
    raise exception 'location_assignments に直接書き込める権限が残っています: %', bad;
  end if;

  select string_agg(format('"%s" (%s)', policyname, cmd), ', ')
    into bad
  from pg_policies
  where schemaname = 'public'
    and tablename = 'location_assignments'
    and cmd <> 'SELECT';
  if bad is not null then
    raise exception 'location_assignments に SELECT 以外のポリシーが残っています: %', bad;
  end if;
end;
$$;
