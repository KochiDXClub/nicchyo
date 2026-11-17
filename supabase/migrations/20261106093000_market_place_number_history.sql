-- 店舗番号は住所内で一度発行したら再利用しない。移転・出店終了でも行を残す。
alter table public.market_place_memberships add column ended_at timestamptz;

-- 未接続の基盤から既存番号の最大値を採用し、それより先から採番する。
create table public.market_place_number_counters (
  location_id uuid primary key references public.market_locations(id) on delete restrict,
  last_number integer not null check (last_number between 1 and 999999)
);
insert into public.market_place_number_counters(location_id, last_number)
select location_id, max(vendor_number) from public.market_place_memberships
where vendor_number is not null group by location_id;
alter table public.market_place_number_counters enable row level security;
revoke all on public.market_place_number_counters from public, anon, authenticated, service_role;

-- 旧基盤で番号未設定の関係はまだ使用されていないため、番号を推測せず移行を止める。
do $$ begin
  if exists (select 1 from public.market_place_memberships where vendor_number is null) then
    raise exception 'market_place_number_backfill_required';
  end if;
end $$;
alter table public.market_place_memberships alter column vendor_number set not null;

create function public.allocate_market_place_vendor_number() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.vendor_number is not null then
    raise exception 'market_place_number_is_automatic' using errcode = '23514';
  end if;
  insert into public.market_place_number_counters as counters(location_id, last_number)
    values (new.location_id, 1)
    on conflict (location_id) do update set last_number = counters.last_number + 1
    returning last_number into new.vendor_number;
  return new;
end $$;
create trigger allocate_market_place_vendor_number before insert on public.market_place_memberships
for each row execute function public.allocate_market_place_vendor_number();

create function public.protect_market_place_vendor_number() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'market_place_membership_must_be_retained' using errcode = '23514';
  end if;
  if new.id is distinct from old.id or new.location_id is distinct from old.location_id
     or new.vendor_id is distinct from old.vendor_id or new.vendor_number is distinct from old.vendor_number then
    raise exception 'market_place_number_is_permanent' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger protect_market_place_vendor_number before update or delete on public.market_place_memberships
for each row execute function public.protect_market_place_vendor_number();
