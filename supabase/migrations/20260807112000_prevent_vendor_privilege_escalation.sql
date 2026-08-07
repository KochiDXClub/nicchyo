-- vendors.role による権限昇格を防ぐ
--
-- 背景:
--   vendors.role は市場配置・システム設定・監査ログなど 15 以上の RLS ポリシーが
--   参照する唯一の管理者判定ソースである。
--   一方で "vendor update self" ポリシー（20260224011000）は
--     using (auth.uid() = id) with check (auth.uid() = id)
--   と行単位の制限しか持たず、列単位の制限がない。
--   さらに app/(public)/my-shop/detail/page.tsx はブラウザから直接 vendors を
--   UPDATE しているため authenticated ロールに UPDATE 権限が付与されている。
--   結果として、出店者アカウントを 1 つ持つだけで
--     PATCH /rest/v1/vendors?id=eq.<自分のid>  { "role": "admin" }
--   により管理者へ昇格できてしまう。
--
-- 対策:
--   role / must_change_password の変更を BEFORE UPDATE トリガで拒否する。
--   列単位 GRANT ではなくトリガを使うのは、vendors に列が追加されるたびに
--   my-shop の更新が無言で壊れるのを避けるため（守りたい列だけを明示する）。
--   管理者による role 変更は app/api/admin/users/[id] が service_role で行うため、
--   service_role と DB 管理者だけはこれまでどおり変更できる。

create or replace function public.prevent_vendor_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- サーバー側 API（service_role）と DB 管理者は従来どおり変更できる
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'vendors.role は変更できません'
      using errcode = '42501';
  end if;

  if new.must_change_password is distinct from old.must_change_password then
    raise exception 'vendors.must_change_password は変更できません'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_vendor_privilege_escalation on public.vendors;

create trigger prevent_vendor_privilege_escalation
  before update on public.vendors
  for each row
  execute function public.prevent_vendor_privilege_escalation();

-- 目的: 出店者が自分の vendors 行を通じて管理者権限を取得できる経路を塞ぐ。
