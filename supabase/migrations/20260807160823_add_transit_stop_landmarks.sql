-- とさでん交通の停留場6件・JR高知駅の丸型バッジアイコンを map_landmarks に追加する。
-- 旧「高知駅」建物アイコン(station)は、新しい丸型バッジ(jr-kochi-station)に統合したため削除する。
--
-- 出典: feature/dev-map ブランチの
--   supabase/migrations/20260621000000_add_transit_landmarks.sql（PR #348）
-- からの抜粋。同PRに含まれていた以下は本マイグレーションのスコープ外のため含めない：
--   - 装飾用「JR列車」アイコン(jr-train)の追加（最大縮小時の背景イラストと
--     向きを合わせるための追加回転とセットで導入されたもので、背景イラスト
--     機能自体を本リポジトリに取り込んでいないため単独では意味を持たない）
--   - 「チンチン電車」(densha)の位置・サイズ調整（同じく背景イラストの
--     描き込みに合わせた調整のため、単独で適用すると実座標から外れる）

insert into map_landmarks (
  key,
  name,
  description,
  image_url,
  latitude,
  longitude,
  width_px,
  height_px,
  show_at_min_zoom
)
values
  (
    'tram-hasuikemachidori',
    '蓮池町通停留場',
    'とさでん交通の路面電車停留場（駅前線）。',
    '/images/maps/elements/transit/tram-stop.svg',
    33.5618694,
    133.5432083,
    40,
    40,
    true
  ),
  (
    'tram-ohashidori',
    '大橋通停留場',
    'とさでん交通の路面電車停留場（伊野線）。',
    '/images/maps/elements/transit/tram-stop.svg',
    33.5589806,
    133.5366611,
    40,
    40,
    true
  ),
  (
    'tram-harimayabashi',
    'はりまや橋停留場',
    'とさでん交通の路面電車停留場。後免線・伊野線・桟橋線・駅前線が乗り入れる主要停留場です。',
    '/images/maps/elements/transit/tram-stop.svg',
    33.5596333,
    133.5423972,
    40,
    40,
    true
  ),
  (
    'tram-horizume',
    '堀詰停留場',
    'とさでん交通の路面電車停留場（伊野線）。',
    '/images/maps/elements/transit/tram-stop.svg',
    33.5594944,
    133.5392306,
    40,
    40,
    true
  ),
  (
    'tram-kochijomae',
    '高知城前停留場',
    'とさでん交通の路面電車停留場（伊野線）。高知城・日曜市の最寄り停留場です。',
    '/images/maps/elements/transit/tram-stop.svg',
    33.5585056,
    133.5339250,
    40,
    40,
    true
  ),
  (
    'tram-kochiekimae',
    '高知駅前停留場',
    'とさでん交通の路面電車停留場（駅前線）。JR高知駅のすぐ南にあります。',
    '/images/maps/elements/transit/tram-stop.svg',
    33.5668361,
    133.5436528,
    40,
    40,
    true
  ),
  (
    'jr-kochi-station',
    '高知駅',
    'JR高知駅。土讃線・特急が発着する、県外から日曜市へ向かう主要な玄関口です。',
    '/images/maps/elements/transit/train-stop.svg',
    33.567691786705,
    133.5436611,
    40,
    40,
    true
  )
on conflict (key) do nothing;

-- 丸型バッジ（jr-kochi-station）に統合したため、旧・駅舎の建物アイコンを削除する
delete from map_landmarks where key = 'station';
