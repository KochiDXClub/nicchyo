-- 位置情報の許可・拒否の件数を数える location_permission_counts を追加する。
--
-- 方針:
-- 数えるのは「許可」「拒否」それぞれの合計だけ。ID・IP・緯度経度・日時の行は持たない。
-- 1 件増やすのは service_role の関数だけ（クライアントからの直接書き込みは不可）。

create table if not exists public.location_permission_counts (
  choice text primary key,
  count bigint not null default 0,
  constraint location_permission_counts_choice_check check (choice in ('allowed', 'denied'))
);

insert into public.location_permission_counts (choice, count)
values ('allowed', 0), ('denied', 0)
on conflict (choice) do nothing;

-- 直接は誰も読み書きしない（service_role は RLS を通らない）
alter table public.location_permission_counts enable row level security;
revoke all on table public.location_permission_counts from public, anon, authenticated;

-- 1 件増やす。関数は既定で PUBLIC が実行できるので、revoke が要る。
create or replace function public.increment_location_permission_count(p_choice text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.location_permission_counts
  set count = count + 1
  where choice = p_choice;
$$;

revoke execute on function public.increment_location_permission_count(text) from public, anon, authenticated;
grant execute on function public.increment_location_permission_count(text) to service_role;
