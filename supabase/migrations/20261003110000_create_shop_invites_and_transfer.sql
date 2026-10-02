-- 出店者アカウント構造の刷新 (4/4 の DB): 招待リンクと、代表者の引き継ぎ。
--
-- 招待リンク
--   - 有効期限は発行から 7 日。1 本のリンクで入れる人数は 1〜5 人（発行時に決める）
--   - 入った人に付ける権限は発行時に決める（shop_members.permissions と同じ権限キー）
--   - リンクの本体（トークン）は DB に置かない。SHA-256 のハッシュだけを持ち、発行時にだけ URL を見せる
--   - 読み書きは API（service_role）だけ。ブラウザからは触れない
-- 受け取り（accept_shop_invite）と引き継ぎ（transfer_shop_ownership）は、
-- 「人数の確認 → 追加 → 使用回数の加算」「降格 → 昇格」を 1 回の処理でやる必要があるので関数にする。
-- どちらも service_role だけが実行できる（API が認証・権限・操作ログを済ませてから呼ぶ）。

create table if not exists public.shop_invites (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  token_hash  text not null,
  permissions text[] not null default '{}',
  max_uses    smallint not null,
  used_count  smallint not null default 0,
  expires_at  timestamptz not null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,

  constraint shop_invites_token_hash_key unique (token_hash),
  constraint shop_invites_max_uses_range check (max_uses between 1 and 5),
  constraint shop_invites_used_count_range check (used_count >= 0 and used_count <= max_uses),
  -- 有効期限は発行から 7 日まで（長い期限のリンクを API の不具合で作らないための最後の砦）
  constraint shop_invites_expiry_within_7_days check (expires_at <= created_at + interval '7 days'),
  constraint shop_invites_permissions_check check (
    permissions <@ array[
      'store_edit', 'post', 'ai_notes', 'inquiries', 'analytics', 'audit_view', 'members_manage'
    ]::text[]
  )
);

comment on table public.shop_invites is
  '店舗への招待リンク。トークンはハッシュだけを保存する。有効期限 7 日・1〜5 人まで。service_role のみ読み書きする。';

create index if not exists shop_invites_vendor_id_idx on public.shop_invites (vendor_id, created_at desc);
create index if not exists shop_invites_created_by_idx on public.shop_invites (created_by);

alter table public.shop_invites enable row level security;
-- ポリシーも grant も付けない（service_role だけが扱う）
revoke all on public.shop_invites from anon, authenticated;

-- ── 招待を受ける ──────────────────────────────────────────────────────
-- 戻り値 status: ok / invalid（無い・取り消し済み）/ expired / full（人数に達した）/ already_member（すでにどこかの店舗に入っている）
create or replace function public.accept_shop_invite(p_token_hash text, p_user_id uuid)
returns table (status text, vendor_id uuid, permissions text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.shop_invites%rowtype;
begin
  -- 同じリンクを同時に使われても人数を超えないよう、行を締める
  select * into inv from public.shop_invites i where i.token_hash = p_token_hash for update;

  if not found or inv.revoked_at is not null then
    return query select 'invalid'::text, null::uuid, null::text[];
    return;
  end if;
  if inv.expires_at <= now() then
    return query select 'expired'::text, null::uuid, null::text[];
    return;
  end if;
  if inv.used_count >= inv.max_uses then
    return query select 'full'::text, null::uuid, null::text[];
    return;
  end if;
  -- 1 アカウントが入れる店舗は 1 つ（shop_members_one_shop_per_user）。リンクは消費しない
  if exists (select 1 from public.shop_members m where m.user_id = p_user_id) then
    return query select 'already_member'::text, null::uuid, null::text[];
    return;
  end if;

  begin
    insert into public.shop_members (vendor_id, user_id, role, permissions, invited_by)
    values (inv.vendor_id, p_user_id, 'member', inv.permissions, inv.created_by);
  exception when unique_violation then
    -- 同じアカウントが同時に 2 回押した場合など。リンクは消費しない
    return query select 'already_member'::text, null::uuid, null::text[];
    return;
  end;

  update public.shop_invites set used_count = used_count + 1 where id = inv.id;

  return query select 'ok'::text, inv.vendor_id, inv.permissions;
end;
$$;

-- ── 代表者の引き継ぎ ──────────────────────────────────────────────────
-- 代表者は店舗ごとに 1 人（部分ユニーク索引）なので、先に今の代表者を外してから新しい代表者を立てる。
-- 今の代表者は、店舗に残る「副代表」（全権限のメンバー）になる。
-- 戻り値 status: ok / not_owner（from が代表者ではない）/ not_member（to がこの店舗のメンバーではない）/ same_user
create or replace function public.transfer_shop_ownership(p_vendor_id uuid, p_from_user uuid, p_to_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_from_user = p_to_user then
    return 'same_user';
  end if;

  -- 同時の操作で代表者が 0 人・2 人にならないよう、この店舗の行をまとめて締める
  perform 1 from public.shop_members m where m.vendor_id = p_vendor_id for update;

  if not exists (
    select 1 from public.shop_members m
    where m.vendor_id = p_vendor_id and m.user_id = p_from_user and m.role = 'owner'
  ) then
    return 'not_owner';
  end if;
  if not exists (
    select 1 from public.shop_members m
    where m.vendor_id = p_vendor_id and m.user_id = p_to_user and m.role = 'member'
  ) then
    return 'not_member';
  end if;

  update public.shop_members
     set role = 'member',
         permissions = array['store_edit', 'post', 'ai_notes', 'inquiries', 'analytics', 'audit_view', 'members_manage'],
         updated_at = now()
   where vendor_id = p_vendor_id and user_id = p_from_user;

  update public.shop_members
     set role = 'owner', permissions = '{}', updated_at = now()
   where vendor_id = p_vendor_id and user_id = p_to_user;

  return 'ok';
end;
$$;

revoke all on function public.accept_shop_invite(text, uuid) from public, anon, authenticated;
revoke all on function public.transfer_shop_ownership(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_shop_invite(text, uuid) to service_role;
grant execute on function public.transfer_shop_ownership(uuid, uuid, uuid) to service_role;
