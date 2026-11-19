-- 日曜市の日ごとの一言に加えて、画像（任意）を載せられるようにする。
-- 画像は market_events と同じアップロードAPI（vendor-images/market-events/）で作り、
-- ここには公開URLを保存する。null なら画像なし（従来どおりの表示）。

ALTER TABLE market_days ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN market_days.image_url IS 'その日曜の画像（任意）。アップロードAPIが返した公開URLのみ保存する。';

-- 公開列の許可リストに image_url を加える（updated_by は引き続き公開しない）。
-- 列単位 GRANT は既存の許可を置き換えないため、追加分だけを GRANT する。
GRANT SELECT (image_url) ON public.market_days TO anon;
GRANT SELECT (image_url) ON public.market_days TO authenticated;
