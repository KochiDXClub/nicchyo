-- 地図の JR 列車アイコン（key: jr-train）を map_landmarks から削除する。
-- 参照している画像 /images/maps/elements/buildings/vapor-train.webp はリポジトリに存在せず、
-- 読み込みに失敗してコンソールに警告が出ていたため、行ごと取り除く。
-- 20260807160823_add_transit_stop_landmarks.sql で意図的に入れていない行。

delete from map_landmarks where key = 'jr-train';
