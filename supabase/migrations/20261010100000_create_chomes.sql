-- 日曜市の「丁目」を、自由入力の文字（market_locations.district）から、決まった一覧（マスタ）に移す (1/4)。
--
-- 日曜市の「○丁目」は日曜市独自の区分で、開催場所の住所（高知市追手筋1・2丁目）とは別物。
-- 東端が1丁目で、西へ6丁目まで追手筋が続く。7丁目だけは、5丁目と6丁目の境目にある大橋通り沿い。
--
-- この PR でやること（足すだけ。既存の列・処理は変えない）:
--   - chomes（マスタ）を作る。書き込みは service_role だけ、読むのは誰でも
--   - market_locations.chome_id を足し、既存の district から埋める
--   - district を書き換えたとき chome_id が追従するトリガを置く
--     （保存 API・復元・CSV は、まだ district だけを書く。それらを chome_id に切り替えるまでの橋渡し）
--
-- 戻し方: district は一切変えないので、元に戻すなら chome_id 列とトリガを落とすだけでよい
--   （そのためスナップショットは作らない。district が移行前の値のまま残っている）。
--
-- 番号範囲は住所録（2024年版）の値で毎年変わりうるので、判定には使わず警告の目安にだけ使う。

create table if not exists public.chomes (
  id             smallint primary key check (id between 1 and 7),
  name           text not null unique,      -- 「日曜市1丁目」
  short_name     text not null unique,      -- 「1丁目」
  road_name      text not null,             -- 通り
  east_boundary  text,                      -- 東側の境目の交差点
  west_boundary  text,                      -- 西側の境目の交差点
  sort_order     smallint not null unique,
  color          text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),  -- 住所録の配色
  ref_number_min integer,                   -- 住所録の番号範囲（参考。警告の目安にだけ使う）
  ref_number_max integer
);

comment on table public.chomes is
  '日曜市の丁目マスタ（1〜7）。住所の丁目ではない。書き込みは service_role のみ。';

insert into public.chomes (id, name, short_name, road_name, east_boundary, west_boundary, sort_order, color, ref_number_min, ref_number_max)
values
  (1, '日曜市1丁目', '1丁目', '追手筋', '駅前電車通り', '廿代通り',       1, '#7FD3F7',   2,  88),
  (2, '日曜市2丁目', '2丁目', '追手筋', '廿代通り',     'グリーンロード', 2, '#7FD1A2',  90, 144),
  (3, '日曜市3丁目', '3丁目', '追手筋', 'グリーンロード', '堀詰通り',     3, '#F9A71A', 145, 220),
  (4, '日曜市4丁目', '4丁目', '追手筋', '堀詰通り',     '中の橋通り',     4, '#FFF100', 222, 307),
  (5, '日曜市5丁目', '5丁目', '追手筋', '中の橋通り',   '大橋通り',       5, '#F481A9', 310, 452),
  (6, '日曜市6丁目', '6丁目', '追手筋', '大橋通り',     '追手門（高知城）', 6, '#D9E60F', 455, 596),
  (7, '日曜市7丁目', '7丁目', '大橋通り', '追手筋との交差点から南へ', null, 7, '#9DB4E0', 617, 644)
on conflict (id) do nothing;

alter table public.chomes enable row level security;
revoke all on public.chomes from anon, authenticated;
grant select on public.chomes to anon, authenticated;

drop policy if exists "public read chomes" on public.chomes;
create policy "public read chomes"
  on public.chomes for select using (true);

-- 表記ゆれ（全角数字・漢数字・「日曜市」「丁目」の有無・空白）を 1〜7 に直す。
-- 1〜7 に読めないもの（空欄・8丁目・別の文字）は null を返し、自動では変換しない。
create or replace function public.normalize_chome_number(p_value text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case
    when s ~ '^[1-7]$' then s::smallint
    else null
  end
  from (
    select regexp_replace(
             translate(coalesce(p_value, ''), '０１２３４５６７８９一二三四五六七', '01234567891234567'),
             '(日曜市|丁目|\s|　)', '', 'g'
           ) as s
  ) t;
$$;

revoke all on function public.normalize_chome_number(text) from public, anon, authenticated;
grant execute on function public.normalize_chome_number(text) to authenticated, service_role;

-- 区画は丁目を、マスタへの参照で持つ（参照の正しさは外部キーが DB で守る）
alter table public.market_locations
  add column if not exists chome_id smallint references public.chomes (id);

create index if not exists market_locations_chome_id_idx
  on public.market_locations (chome_id);

-- district を書いたら chome_id が追従する（chome_id を直接指定した挿入は、そのまま通す）
create or replace function public.sync_market_location_chome_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.chome_id is not null then
    return new;
  end if;
  if tg_op = 'INSERT' or new.district is distinct from old.district then
    new.chome_id := public.normalize_chome_number(new.district);
  end if;
  return new;
end;
$$;

revoke all on function public.sync_market_location_chome_id() from public, anon, authenticated;

drop trigger if exists market_locations_sync_chome_id on public.market_locations;
create trigger market_locations_sync_chome_id
  before insert or update of district on public.market_locations
  for each row execute function public.sync_market_location_chome_id();

-- 既存データの移行
update public.market_locations
   set chome_id = public.normalize_chome_number(district)
 where chome_id is null
   and district is not null;

-- 判定できなかったものを報告する（自動変換しない。デプロイのログに残る）
do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select store_number, district
      from public.market_locations
     where district is not null
       and btrim(district) <> ''
       and chome_id is null
     order by store_number
  loop
    n := n + 1;
    raise notice '丁目を判定できない区画: 店番 %, district = "%"', r.store_number, r.district;
  end loop;
  if n > 0 then
    raise notice '丁目を判定できなかった区画は % 件（chome_id は null のまま。手で直す）', n;
  end if;
end;
$$;
