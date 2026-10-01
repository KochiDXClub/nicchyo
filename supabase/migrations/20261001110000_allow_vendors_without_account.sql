-- 出店者（vendors）を、ログインアカウント（auth.users）なしでも登録できるようにする。
--
-- これまで vendors.id は auth.users.id への外部キーで、出店者はアカウント招待
-- （/api/admin/users の inviteUserByEmail）からしか作れなかった。
-- 運用を「運営が分かる情報を先に出店者として登録し、あとから出店者のアカウントに
-- 紐づける」形に変えるため、マップ編集画面の空き区画から出店者を新規登録できるようにする。
--
-- 影響と対策:
--   - 外部キーの ON DELETE CASCADE（アカウントを消すと出店者も消える）に頼っている
--     処理がある（/api/admin/shops/bulk の一括削除）。アカウントのある出店者は
--     これまでどおり消えるよう、auth.users の削除時に同じ id の vendors を消すトリガーを置く
--   - RLS の「本人だけ」（vendors.id = auth.uid()）は、アカウントのない出店者の行には
--     誰も当てはまらないだけなので、見える範囲は広がらない
--   - 既存の出店者の id（= アカウントの id）は変えない
--
-- 今後「アカウントのない出店者に、出店者本人のアカウントを紐づける」機能を作るときの注意:
--   vendors.id を書き換える・その id を指定してアカウントを作る（auth.admin.createUser({ id })）
--   といった紐づけを、利用者が自分で起こせる形にすると、他人の出店者データを乗っ取れてしまう。
--   紐づけは管理者専用の API（service_role）に限り、監査ログに残すこと

alter table vendors drop constraint if exists vendors_id_fkey;
alter table vendors alter column id set default gen_random_uuid();

create or replace function public.delete_vendor_on_auth_user_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.vendors where id = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted_delete_vendor on auth.users;
create trigger on_auth_user_deleted_delete_vendor
  after delete on auth.users
  for each row execute function public.delete_vendor_on_auth_user_delete();

-- トリガー専用。直接呼べないようにする（20260906123419 と同じ方針）
revoke execute on function public.delete_vendor_on_auth_user_delete() from public, anon, authenticated;
