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
    '/images/maps/elements/buildings/vapor-train.png',
    33.5671869,
    133.54738743209438,
    120,
    80,
    true
  )
on conflict (key) do nothing;
