-- 代表者の退会（準備）を 1 つのトランザクションにまとめる。
--
-- 退会 API は「他のメンバーがいないか数える → 招待を取り消す → アカウントを消す」の順に動く。
-- API 側でばらばらに行うと、数えたあとに招待リンクで別の人が入り、
-- 代表者のいない店舗にメンバーだけが残ることがあった。
-- 店舗の行を締めたまま、確認・招待の取り消し・氏名の削除をまとめて行う
-- （招待の受け入れ accept_shop_invite も店舗の行を先に締めるので、同時に来ても順番に処理される）。
--
-- 戻り値: ok / not_owner（呼んだ人が代表者ではない）/ has_members（代表者以外のメンバーがいる）
create or replace function public.begin_owner_withdrawal(p_vendor_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.vendors v where v.id = p_vendor_id for update;
  if not found then
    return 'not_owner';
  end if;

  if not exists (
    select 1 from public.shop_members m
    where m.vendor_id = p_vendor_id and m.user_id = p_user_id and m.role = 'owner'
  ) then
    return 'not_owner';
  end if;

  if exists (
    select 1 from public.shop_members m
    where m.vendor_id = p_vendor_id and m.user_id <> p_user_id
  ) then
    return 'has_members';
  end if;

  update public.shop_invites set revoked_at = now()
   where vendor_id = p_vendor_id and revoked_at is null;
  delete from public.vendor_owner_profiles where vendor_id = p_vendor_id;
  return 'ok';
end;
$$;

revoke all on function public.begin_owner_withdrawal(uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_owner_withdrawal(uuid, uuid) to service_role;
