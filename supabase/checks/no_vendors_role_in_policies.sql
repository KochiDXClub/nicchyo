-- RLS ポリシーが vendors.role で運営（管理者）を判定していないことを確かめる（#757）。
--
-- vendors.role は 20260807120000 で authenticated の列 GRANT から外れている。ポリシーの式に
--   exists (select 1 from vendors where vendors.id = auth.uid() and vendors.role ...)
-- を書くと、ログイン中の利用者が評価した時点で "permission denied for table vendors"（PostgREST では 403）になる。
-- 管理者アカウントには vendors 行も無い。運営判定は public.current_user_role() / public.is_operator()
-- （auth.jwt() の app_metadata.role）に寄せること。
--
-- あわせて、この2関数は anon に EXECUTE を与えていない。ポリシーが to anon / to public（to 省略）のままだと、
-- 同じテーブルを anon が読む（公開 SELECT がある）ときにも評価されて permission denied になる。
-- そのため、これらを使うポリシーは to authenticated（または service_role）に限定する。
--
-- 使い方（CI の Migrations Check で実行している）:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/checks/no_vendors_role_in_policies.sql

do $$
declare
  offenders text;
begin
  -- 1. vendors.role を見ているポリシー
  select string_agg(format('%s.%s "%s"', schemaname, tablename, policyname), E'\n  ' order by schemaname, tablename, policyname)
    into offenders
  from pg_policies
  where schemaname in ('public', 'storage')
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* 'vendors[[:space:]]*\.[[:space:]]*"?role';

  if offenders is not null then
    raise exception E'vendors.role で権限判定しているポリシーが残っています（current_user_role() / is_operator() に置き換えてください）:\n  %', offenders;
  end if;

  -- 2. current_user_role() / is_operator() を、anon にも評価されうる対象（public / anon）で使っているポリシー
  select string_agg(format('%s.%s "%s" (roles: %s)', schemaname, tablename, policyname, roles::text), E'\n  ' order by schemaname, tablename, policyname)
    into offenders
  from pg_policies
  where schemaname in ('public', 'storage')
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* '(current_user_role|is_operator)'
    and (roles && array['public', 'anon']::name[]);

  if offenders is not null then
    raise exception E'current_user_role() / is_operator() を使うポリシーが anon にも適用されています（to authenticated に限定してください）:\n  %', offenders;
  end if;
end;
$$;
