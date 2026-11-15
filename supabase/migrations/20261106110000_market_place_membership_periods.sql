-- 一つの店舗が何度も同じ住所に戻る場合も、番号を変えずに期間を残す。
-- 既存の終了状態は開始日を推測できないため、自動変換せず移行を止める。
do $$ begin
  if exists (select 1 from public.market_place_memberships) then
    raise exception 'market_place_membership_period_backfill_required';
  end if;
end $$;
alter table public.market_place_memberships drop column ended_at;

create table public.market_place_membership_periods (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.market_place_memberships(id) on delete restrict,
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default now(),
  unique (id, membership_id),
  check (ends_on is null or ends_on >= starts_on)
);
create index market_place_membership_periods_membership_idx on public.market_place_membership_periods (membership_id, starts_on);
alter table public.market_place_membership_periods enable row level security;
revoke all on public.market_place_membership_periods from public, anon, authenticated;
grant select, insert, update, delete on public.market_place_membership_periods to service_role;

-- 親をロックして、同時に2件を登録した場合にも期間の重複を防ぐ。
create function public.check_market_place_membership_period() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'market_place_period_must_be_retained' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.membership_id is distinct from old.membership_id then
    raise exception 'market_place_period_membership_immutable' using errcode = '23514';
  end if;
  perform 1 from public.market_place_memberships where id = new.membership_id for update;
  if exists (
    select 1 from public.market_place_membership_periods p
    where p.membership_id = new.membership_id and p.id <> new.id
      and daterange(p.starts_on, p.ends_on, '[]') && daterange(new.starts_on, new.ends_on, '[]')
  ) then
    raise exception 'market_place_membership_period_overlap' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger check_market_place_membership_period before insert or update or delete on public.market_place_membership_periods
for each row execute function public.check_market_place_membership_period();
