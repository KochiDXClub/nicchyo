-- 地図の建物（ランドマーク）画像を PNG から WebP に切り替える。
--
-- public/images/maps/elements/buildings/ の PNG（1枚2〜3MB）を WebP に置き換えて PNG を削除したので、
-- map_landmarks.image_url が指す先も .webp にそろえる。Vercel のデプロイ容量を減らすための変更。
--
-- 対象は buildings/ 配下の .png だけ。すでに .webp の行・他の場所を指す行は変えないので、
-- 二重に当たっても同じ結果になる。

update map_landmarks
set image_url = regexp_replace(image_url, '\.png$', '.webp')
where image_url like '/images/maps/elements/buildings/%.png';

-- にちよさん（RAG）の知識データ（data/knowledge.csv → knowledge_embeddings）も同じ画像を指しているので、そろえる。
update knowledge_embeddings
set image_url = regexp_replace(image_url, '\.png$', '.webp')
where image_url like '/images/maps/elements/buildings/%.png';
