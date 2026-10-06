-- 「アカウントID = 店舗ID」という旧い判定（auth.uid() だけで店舗の行を絞る RLS）が残っていないかを確かめる。
--
-- 店舗のメンバー制（shop_members / has_shop_permission）に張り替えたあとに、旧い判定が残っていると
--   1. メンバーが（権限があっても）使えない
--   2. 店舗から外したはずの旧アカウントが、引き続き読み書きできる
-- の両方が起きる。テーブルを足したときの張り替え漏れを、全マイグレーションを流した DB で検出する。
--
-- 使い方（CI の Migrations Check で実行している）:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/checks/no_legacy_vendor_policies.sql
--
-- 次のものは旧い判定ではないので対象外にしている:
--   - has_shop_permission / is_shop_member / is_shop_owner / shop_members を使うもの（新しい判定）
--   - vendors.role や is_operator()・current_user_role() を見る、運営向けのもの
--   - sender_id = auth.uid()（問い合わせの返信を「実際に書いた人」に固定するもの）
--   - user-avatars バケット（アカウント本人のプロフィール写真。フォルダ名 = 本人の auth.uid()。店舗のデータではない）
-- 上のどれにも当たらないのに auth.uid() を使うポリシーが見つかったら、権限判定に張り替えるか、
-- 張り替えが不要な理由を確かめたうえで、この検査の対象外に足す。

do $$
declare
  offenders text;
begin
  select string_agg(format('%s.%s "%s"', schemaname, tablename, policyname), E'\n  ' order by schemaname, tablename, policyname)
    into offenders
  from pg_policies
  where schemaname in ('public', 'storage')
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* 'auth\.uid'
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) !~* '(has_shop_permission|is_shop_member|is_shop_owner|shop_members|vendors\.role|is_operator|current_user_role|sender_id|user-avatars)';

  if offenders is not null then
    raise exception E'旧い判定（auth.uid() だけ）のポリシーが残っています:\n  %', offenders;
  end if;
end;
$$;
