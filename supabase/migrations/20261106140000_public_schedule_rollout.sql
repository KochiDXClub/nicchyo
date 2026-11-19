-- 準備が終わるまでは従来の公開表示を継続する。切替は管理者が明示的に行う。
create table public.public_schedule_rollout (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.public_schedule_rollout(id) values (true);
alter table public.public_schedule_rollout enable row level security;
revoke all on public.public_schedule_rollout from public, anon, authenticated;
grant select, update on public.public_schedule_rollout to service_role;

-- 固定IDに移行した後に場所番号へ戻すと、お気に入りが別店舗を指しうる。
create function public.prevent_public_schedule_rollback() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.enabled and not new.enabled then raise exception 'public_schedule_rollback_not_allowed' using errcode = '23514'; end if;
  return new;
end $$;
create trigger prevent_public_schedule_rollback before update on public.public_schedule_rollout
  for each row execute function public.prevent_public_schedule_rollback();

create function public.set_public_schedule_rollout(p_enabled boolean, p_expected integer, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_revision integer; v_enabled boolean;
begin
  if p_enabled is null or p_expected is null or p_actor is null then return jsonb_build_object('status','invalid'); end if;
  select revision, enabled into v_revision, v_enabled from public.public_schedule_rollout where id for update;
  if v_revision is distinct from p_expected then return jsonb_build_object('status','stale'); end if;
  if v_enabled and not p_enabled then return jsonb_build_object('status','irreversible'); end if;
  if p_enabled and not exists (select 1 from public.market_place_schedule_rules where voided_at is null) and not exists (select 1 from public.market_place_schedule_overrides where not is_cleared and membership_id is not null) then
    return jsonb_build_object('status','no_rules');
  end if;
  update public.public_schedule_rollout set enabled = p_enabled, revision = revision + 1, updated_at = clock_timestamp(), updated_by = p_actor where id;
  return jsonb_build_object('status','ok');
end $$;
revoke all on function public.set_public_schedule_rollout(boolean,integer,uuid) from public, anon, authenticated;
grant execute on function public.set_public_schedule_rollout(boolean,integer,uuid) to service_role;
-- 公開店舗の固定番号だけを anon の行レベル制御のもとで読み出す。
grant select (public_shop_id) on public.vendors to anon, authenticated;

-- 確定の誤りは付け替えず無効化する。既存 URL が別店舗になることを防ぐ。
create table public.legacy_shop_identity_revocations (
  legacy_shop_id integer primary key references public.legacy_shop_identity_aliases(legacy_shop_id) on delete restrict,
  revoked_by uuid not null,
  reason text not null check (length(btrim(reason)) between 10 and 1000),
  revoked_at timestamptz not null default now()
);
alter table public.legacy_shop_identity_revocations enable row level security;
revoke all on public.legacy_shop_identity_revocations from public, anon, authenticated;
grant select, insert on public.legacy_shop_identity_revocations to service_role;
create function public.protect_legacy_shop_identity_revocation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'legacy_shop_identity_revocation_is_immutable';
end $$;
create trigger legacy_shop_identity_revocation_immutable before update or delete on public.legacy_shop_identity_revocations
  for each row execute function public.protect_legacy_shop_identity_revocation();
