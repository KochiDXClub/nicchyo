-- 市ごとの丁目（区画のエリア）。管理画面で市ごとに追加・名前変更・並べ替え・削除できるようにする。
-- label は区画の district に入る値（日曜市は従来の「一丁目」など）。区画は district の文字列で丁目を持つので、
-- 名前を変えるときは、その市の区画の district も同じ値に書き換える（rename_market_area）。
-- 日曜市の初期行は、従来の固定の丁目（一丁目〜七丁目）と同じ値にする。木曜市などは管理画面で登録する。

create table if not exists public.market_areas (
  id         uuid        primary key default gen_random_uuid(),
  market_id  uuid        not null references public.markets(id) on delete restrict,
  label      text        not null check (char_length(label) between 1 and 10),
  sort_order integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_areas_market_label_key unique (market_id, label)
);

create index if not exists market_areas_market_sort_idx on public.market_areas(market_id, sort_order);

comment on table public.market_areas is '市ごとの丁目（区画のエリア）。label は market_locations.district に入る値。';

insert into public.market_areas (market_id, label, sort_order)
select m.id, v.label, v.sort_order
from public.markets m
cross join (values
  ('一丁目', 1), ('二丁目', 2), ('三丁目', 3), ('四丁目', 4),
  ('五丁目', 5), ('六丁目', 6), ('七丁目', 7)
) as v(label, sort_order)
where m.slug = 'nichiyo'
on conflict (market_id, label) do nothing;

alter table public.market_areas enable row level security;

-- 公開されている市の丁目は誰でも見られる。
-- 非公開の市の丁目は管理者だけが見られる（current_user_role() を使う方は to authenticated に限定する）。
-- 書き込みは管理画面の API（service role）だけが行う。
create policy "market_areas_select_public"
  on public.market_areas for select
  using (market_id in (select id from public.markets where is_public));

create policy "market_areas_select_admin"
  on public.market_areas for select
  to authenticated
  using ((select public.current_user_role()) = 'admin');

grant select on public.market_areas to anon, authenticated;

-- 丁目の名前を変える。同じ市の区画の district も同時に書き換える（片方だけ変わらないように1つの関数で行う）。
create or replace function public.rename_market_area(p_id uuid, p_label text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_market_id uuid;
  v_old_label text;
begin
  select market_id, label into v_market_id, v_old_label
  from public.market_areas where id = p_id for update;
  if not found then
    raise exception 'market_area_not_found' using errcode = 'P0002';
  end if;
  if v_old_label = p_label then
    return;
  end if;
  update public.market_areas set label = p_label, updated_at = now() where id = p_id;
  update public.market_locations set district = p_label
  where market_id = v_market_id and district = v_old_label;
end;
$$;

revoke execute on function public.rename_market_area(uuid, text) from public, anon, authenticated;
grant execute on function public.rename_market_area(uuid, text) to service_role;

-- 丁目の並び順を、渡された id の順に sort_order = 1, 2, 3... と付け直す。
-- 市の丁目すべてが、過不足なく渡されたときだけ変える。
create or replace function public.reorder_market_areas(p_market_id uuid, p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.market_areas where market_id = p_market_id) <> coalesce(cardinality(p_ids), 0)
    or (select count(*) from public.market_areas where market_id = p_market_id and id = any(p_ids)) <> coalesce(cardinality(p_ids), 0) then
    raise exception 'market_area_order_mismatch' using errcode = '23514';
  end if;
  update public.market_areas a
  set sort_order = o.ord, updated_at = now()
  from unnest(p_ids) with ordinality as o(id, ord)
  where a.id = o.id and a.market_id = p_market_id;
end;
$$;

revoke execute on function public.reorder_market_areas(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_market_areas(uuid, uuid[]) to service_role;
