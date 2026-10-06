-- 掲載許可の記録（vendors の listing_consent 系の列）が、来訪者・ログイン済みの一般ユーザーから
-- 直接読めないことを確かめる。
--
-- listing_consent_note には、許可の経緯（誰から・どう許可をもらったか）が入り、個人情報を含みうる。
-- 列の SELECT 権限を付与していないので PostgREST から読めないが、あとのマイグレーションで
-- vendors の GRANT がテーブル全体へ広がると、静かに漏れる。それを CI で検出する。
--
-- 使い方（CI の Migrations Check で実行している）:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/checks/vendor_listing_consent_columns.sql
--
-- listing_status だけは、RLS の判定とクライアントの確認のために SELECT を付与している（機微ではない）。

do $$
declare
  leaked text;
begin
  select string_agg(format('%s.%s', r.role_name, c.column_name), E'\n  ' order by r.role_name, c.column_name)
    into leaked
  from (values ('anon'), ('authenticated')) as r(role_name)
  cross join (values ('photo_use_allowed'), ('listing_consented_on'), ('listing_consent_note')) as c(column_name)
  where has_column_privilege(r.role_name, 'public.vendors', c.column_name, 'SELECT');

  if leaked is not null then
    raise exception E'掲載許可の記録が、来訪者・一般ユーザーから直接読める状態です:\n  %', leaked;
  end if;
end;
$$;
