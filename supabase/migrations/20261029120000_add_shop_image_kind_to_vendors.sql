-- 店舗写真が「普通の写真」か「全周カメラ（360度）の写真」かを記録する。
--
-- normal   … 普通の写真（既定。これまでの写真はすべてこれ）
-- panorama … 全周カメラで撮った写真（横:縦 = 2:1 の正距円筒図法）。
--            バナーにはサムネイルを出し、タップした拡大表示でドラッグして見渡せる。
--
-- 写真の比率からの自動判定ではなく、運営（現地登録）と出店者が登録時に選んだラベルで決める。
-- ラベルは shop_image_url が指す写真（メイン）に付く。写真を消す・差し替えるときは登録の側で更新する。

alter table public.vendors
  add column if not exists shop_image_kind text not null default 'normal';

alter table public.vendors
  drop constraint if exists vendors_shop_image_kind_check;
alter table public.vendors
  add constraint vendors_shop_image_kind_check
  check (shop_image_kind in ('normal', 'panorama'));

comment on column public.vendors.shop_image_kind is
  '店舗写真（shop_image_url）の種類。normal=普通の写真 / panorama=全周カメラ（360度）の写真。';

-- 来訪者の画面（anon / authenticated）が読む列。vendors は列単位で SELECT を付与しているため、ここにも付ける
grant select (shop_image_kind) on public.vendors to anon, authenticated;
