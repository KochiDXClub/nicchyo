-- 出店者アカウント構造の刷新: QR＋トークンで、Google アカウントを店舗に紐づける。
--
-- 本番は店舗データを先に入れ（アカウントなし）、出店者へ配る QR コードで後から紐づける。
-- QR に入っているのは URL（/claim/<トークン>）。最初にスキャンしてログインした人が、その店舗の代表者になる。
--
--   - 1 店舗に有効なトークンは 1 つ（再発行すると前のものは無効になる）
--   - 代表者がいる店舗には発行できない・紐づけできない。やり直すときは、運営が「紐づけの解除」で
--     店舗をアカウントなしの状態に戻してから、再発行する
--   - トークンはハッシュだけを保存する。QR（URL）は発行した直後の 1 回しか見せない
--   - 読み書きは API（service_role）だけ。有効期限は付けない（印刷して配る物なので）。運営が取り消す
-- 発行・紐づけ・解除は、確認と更新を 1 回の処理でやる必要があるので関数にする（service_role だけが実行できる）。

create table if not exists public.shop_claim_tokens (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  token_hash  text not null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  claimed_by  uuid references auth.users (id) on delete set null,
  claimed_at  timestamptz,

  constraint shop_claim_tokens_token_hash_key unique (token_hash)
);

comment on table public.shop_claim_tokens is
  '店舗とアカウントを QR で紐づけるトークン。ハッシュだけ保存。1 店舗に有効なものは 1 つ。service_role のみ読み書きする。';

-- 有効（取り消しも使用もされていない）トークンは店舗ごとに 1 つ
create unique index if not exists shop_claim_tokens_one_active_per_shop
  on public.shop_claim_tokens (vendor_id)
  where revoked_at is null and claimed_at is null;
create index if not exists shop_claim_tokens_created_by_idx on public.shop_claim_tokens (created_by);
create index if not exists shop_claim_tokens_claimed_by_idx on public.shop_claim_tokens (claimed_by);

alter table public.shop_claim_tokens enable row level security;
revoke all on public.shop_claim_tokens from anon, authenticated;

-- ── 発行（再発行） ────────────────────────────────────────────────────
-- 戻り値: ok / no_shop（店舗がない）/ already_claimed（すでに代表者がいる）
create or replace function public.issue_shop_claim_token(p_vendor_id uuid, p_token_hash text, p_created_by uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 同じ店舗への同時の発行・紐づけが競合しないよう、店舗の行を締める
  perform 1 from public.vendors v where v.id = p_vendor_id for update;
  if not found then
    return 'no_shop';
  end if;
  if exists (select 1 from public.shop_members m where m.vendor_id = p_vendor_id and m.role = 'owner') then
    return 'already_claimed';
  end if;

  update public.shop_claim_tokens
     set revoked_at = now()
   where vendor_id = p_vendor_id and revoked_at is null and claimed_at is null;

  insert into public.shop_claim_tokens (vendor_id, token_hash, created_by)
  values (p_vendor_id, p_token_hash, p_created_by);
  return 'ok';
end;
$$;

-- ── 紐づけ（QR を読んだ人が代表者になる） ───────────────────────────────
-- 戻り値 status: ok / invalid（無い・取り消し済み・使用済み）/ already_claimed（先に代表者ができた）/ already_member（この人はすでにどこかの店舗にいる）
create or replace function public.claim_shop_with_token(p_token_hash text, p_user_id uuid)
returns table (status text, vendor_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok public.shop_claim_tokens%rowtype;
begin
  -- ロック順は issue_shop_claim_token / unlink_shop と同じ「店舗 → トークン」にそろえる
  -- （逆順だと、発行と紐づけが同時に起きたときにデッドロックで片方が失敗する）。
  -- 先にロックなしでトークンから店舗を引き、店舗の行を締めてから、トークンを締め直して有効か確かめる。
  select * into tok from public.shop_claim_tokens t where t.token_hash = p_token_hash;
  if not found then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  perform 1 from public.vendors v where v.id = tok.vendor_id for update;

  select * into tok from public.shop_claim_tokens t where t.token_hash = p_token_hash for update;
  if not found or tok.revoked_at is not null or tok.claimed_at is not null then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  if exists (select 1 from public.shop_members m where m.user_id = p_user_id) then
    return query select 'already_member'::text, null::uuid;
    return;
  end if;

  if exists (select 1 from public.shop_members m where m.vendor_id = tok.vendor_id and m.role = 'owner') then
    return query select 'already_claimed'::text, null::uuid;
    return;
  end if;

  begin
    insert into public.shop_members (vendor_id, user_id, role, permissions)
    values (tok.vendor_id, p_user_id, 'owner', '{}');
  exception when unique_violation then
    -- 同じアカウントの同時のスキャンなど。トークンは消費しない
    return query select 'already_member'::text, null::uuid;
    return;
  end;

  update public.shop_claim_tokens set claimed_by = p_user_id, claimed_at = now() where id = tok.id;
  return query select 'ok'::text, tok.vendor_id;
end;
$$;

-- ── 紐づけの解除（店舗をアカウントなしの状態に戻す） ──────────────────────
-- メンバー全員を外し、出ている招待リンクと QR トークンを取り消す。店舗のデータ（商品・投稿など）はそのまま残る。
-- 代表者だけを外すと、メンバーだけが残って代表者のいない店舗になってしまうので、全員を外す。
-- 戻り値: 外したメンバーの数（店舗がなければ -1）
create or replace function public.unlink_shop(p_vendor_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  perform 1 from public.vendors v where v.id = p_vendor_id for update;
  if not found then
    return -1;
  end if;

  delete from public.shop_members m where m.vendor_id = p_vendor_id;
  get diagnostics removed = row_count;

  update public.shop_invites set revoked_at = now() where vendor_id = p_vendor_id and revoked_at is null;
  update public.shop_claim_tokens
     set revoked_at = now()
   where vendor_id = p_vendor_id and revoked_at is null and claimed_at is null;
  return removed;
end;
$$;

revoke all on function public.issue_shop_claim_token(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.claim_shop_with_token(text, uuid) from public, anon, authenticated;
revoke all on function public.unlink_shop(uuid) from public, anon, authenticated;
grant execute on function public.issue_shop_claim_token(uuid, text, uuid) to service_role;
grant execute on function public.claim_shop_with_token(text, uuid) to service_role;
grant execute on function public.unlink_shop(uuid) to service_role;
