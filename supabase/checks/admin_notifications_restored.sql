-- admin_notifications が存在し、通知 API / abuseDetection が使う列が揃い、
-- RLS が有効で、anon は触れず、運営だけが authenticated で読める構成であることを確かめる（#425）。
--
-- 使い方（CI の Migrations Check で実行している）:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/checks/admin_notifications_restored.sql

do $$
declare
  missing text;
begin
  if to_regclass('public.admin_notifications') is null then
    raise exception 'public.admin_notifications がありません（remote_schema での drop 後に再作成されていない）';
  end if;

  select string_agg(c, ', ')
    into missing
  from unnest(array['id', 'type', 'title', 'body', 'link', 'is_read', 'created_at']) as c
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = c
  );
  if missing is not null then
    raise exception 'admin_notifications に列が足りません: %', missing;
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.admin_notifications'::regclass) then
    raise exception 'admin_notifications の RLS が無効です';
  end if;

  if has_table_privilege('anon', 'public.admin_notifications', 'select')
     or has_table_privilege('anon', 'public.admin_notifications', 'insert')
     or has_table_privilege('anon', 'public.admin_notifications', 'update')
     or has_table_privilege('anon', 'public.admin_notifications', 'delete') then
    raise exception 'anon が admin_notifications を操作できます';
  end if;
  if has_table_privilege('authenticated', 'public.admin_notifications', 'insert')
     or has_table_privilege('authenticated', 'public.admin_notifications', 'delete') then
    raise exception 'authenticated が admin_notifications に INSERT / DELETE できます（書き込みは service_role の API のみ）';
  end if;
  if not (has_table_privilege('service_role', 'public.admin_notifications', 'select')
          and has_table_privilege('service_role', 'public.admin_notifications', 'insert')
          and has_table_privilege('service_role', 'public.admin_notifications', 'update')) then
    raise exception 'service_role が admin_notifications を読み書きできません';
  end if;

  -- 運営（is_operator）だけが読める: 運営向け SELECT / UPDATE があり、条件なし（true）のポリシーは無い
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_notifications'
      and cmd = 'SELECT' and qual like '%is_operator%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_notifications'
      and cmd = 'UPDATE' and qual like '%is_operator%'
  ) then
    raise exception 'admin_notifications に is_operator() の SELECT / UPDATE ポリシーがありません';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_notifications'
      and coalesce(qual, 'true') = 'true'
  ) then
    raise exception 'admin_notifications に条件なしのポリシーがあります';
  end if;
end $$;
