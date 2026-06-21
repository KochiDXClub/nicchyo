-- チンチン電車（densha）アイコンを最終位置・最終サイズに調整する
update map_landmarks
set
  latitude = 33.55811917977004,
  longitude = 133.54795508523796,
  width_px = 172.032,
  height_px = 86.016
where key = 'densha';
