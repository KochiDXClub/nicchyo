-- 現場登録（運営が現地で店舗の位置・丁目を聞き取って入れる）の結果を、地図のデータ
-- （market_locations / location_assignments）には触れずに、記録としてだけ残す。
--
-- これまでは「位置を保存」すると、店番の区画の座標を書き換え、割り当てを入れ替えて、公開マップに
-- すぐ反映されていた。現場では聞き取りの確かさにばらつきがあるので、まずここに記録しておき、
-- 地図への反映は運営が地図編集で確かめてから行う。
--
-- 1 店舗につき 1 行（最新の記録だけ）。店番・座標・丁目は、それぞれ未入力でもよい
-- （座標は緯度と経度がそろっているときだけ入れる）。
-- 読み書きは service_role のみ（現場登録の API から。RLS は有効で、ポリシーは置かない）。

create table if not exists public.field_shop_locations (
  vendor_id    uuid primary key references public.vendors (id) on delete cascade,
  store_number integer check (store_number between 1 and 999),
  latitude     double precision,
  longitude    double precision,
  chome_id     smallint references public.chomes (id),
  updated_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint field_shop_locations_latlng_complete check ((latitude is null) = (longitude is null))
);

comment on table public.field_shop_locations is
  '現場登録で聞き取った店舗の店番・座標・丁目の記録。地図（market_locations）には反映しない。service_role のみ。';

alter table public.field_shop_locations enable row level security;
revoke all on public.field_shop_locations from anon, authenticated;
