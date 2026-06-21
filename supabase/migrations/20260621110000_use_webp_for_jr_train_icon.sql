-- vapor-train アイコンをPNG(2.8MB)からWebP(約95KB)に置き換える
update map_landmarks
set image_url = '/images/maps/elements/buildings/vapor-train.webp'
where key = 'jr-train';
