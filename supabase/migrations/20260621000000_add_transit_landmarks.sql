-- JR列車・とさでん交通停留場のランドマークを追加し、
-- 既存の「チンチン電車」位置調整・旧「高知駅」建物アイコンの削除をまとめて行う

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
    'jr-train',
    'JR列車',
    '高知駅に発着するJRの列車。県外からのアクセスの目印になります。',
    '/images/maps/elements/buildings/vapor-train.webp',
    33.5671869,
    133.54738743209438,
    120,
    80,
    true
  ),
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

-- チンチン電車（densha）アイコンを最終位置・最終サイズに調整する
update map_landmarks
set
  latitude = 33.55811917977004,
  longitude = 133.54795508523796,
  width_px = 172.032,
  height_px = 86.016
where key = 'densha';

-- 丸型バッジ（jr-kochi-station）に統合したため、駅舎の建物アイコンを削除する
delete from map_landmarks where key = 'station';
