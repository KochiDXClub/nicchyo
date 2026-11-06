-- 旧店舗番号は場所を表すため、出店者の恒久 ID には使えない。
-- 1000 以上を新しい店舗 ID に予約し、001〜999 の旧 URL と衝突させない。
alter table public.vendors
  add column public_shop_id bigint generated always as identity (start with 1000 no cycle);
alter table public.vendors
  add constraint vendors_public_shop_id_key unique (public_shop_id),
  add constraint vendors_public_shop_id_range check (public_shop_id between 1000 and 2147483647);

create function public.prevent_public_shop_id_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.public_shop_id is distinct from old.public_shop_id then
    raise exception 'public_shop_id_is_immutable';
  end if;
  return new;
end $$;
create trigger vendors_public_shop_id_immutable before update of public_shop_id on public.vendors
  for each row execute function public.prevent_public_shop_id_change();

-- 旧番号は履歴だけでは元の利用者がどの店舗を保存したか確実に分からない。
-- 運営が確認した対応だけを追加する。未確認・曖昧なものは空のままにする。
-- 行は削除できず、店舗が削除された後も番号は別店舗に使い回さない。
create table public.legacy_shop_identity_aliases (
  legacy_shop_id integer primary key check (legacy_shop_id between 1 and 999),
  vendor_id uuid references public.vendors(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid not null, -- auth.users.id。退会後も確認者の記録を残す。
  evidence text not null check (length(btrim(evidence)) between 1 and 1000)
);
alter table public.legacy_shop_identity_aliases enable row level security;
revoke all on public.legacy_shop_identity_aliases from public, anon, authenticated;
grant select, insert on public.legacy_shop_identity_aliases to service_role;

create function public.protect_legacy_shop_identity_alias() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.vendor_id is null then raise exception 'legacy_shop_identity_requires_vendor'; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then raise exception 'legacy_shop_identity_alias_is_immutable'; end if;
  -- FK の ON DELETE SET NULL のみ許可し、一度決めた参照先の変更を防ぐ。
  if new.legacy_shop_id is distinct from old.legacy_shop_id
    or new.confirmed_at is distinct from old.confirmed_at
    or new.confirmed_by is distinct from old.confirmed_by
    or new.evidence is distinct from old.evidence
    or new.vendor_id is not null
  then raise exception 'legacy_shop_identity_alias_is_immutable'; end if;
  return new;
end $$;
create trigger legacy_shop_identity_alias_immutable before insert or update or delete on public.legacy_shop_identity_aliases
  for each row execute function public.protect_legacy_shop_identity_alias();

-- 履歴は確認材料であって自動確定の根拠ではない（欠落・削除済みの履歴があり得る）。
create view public.legacy_shop_identity_candidates with (security_invoker = true) as
  select location.store_number as legacy_shop_id,
    array_agg(distinct candidate.vendor_id order by candidate.vendor_id) as vendor_ids,
    count(distinct candidate.vendor_id) as candidate_count
  from public.market_locations location
  join (
    select location_id, vendor_id from public.location_assignments where vendor_id is not null
    union
    select market_place_id as location_id, id as vendor_id from public.vendors where market_place_id is not null
  ) candidate on candidate.location_id = location.id
  where location.store_number between 1 and 999
  group by location.store_number;
revoke all on public.legacy_shop_identity_candidates from public, anon, authenticated;
grant select on public.legacy_shop_identity_candidates to service_role;
