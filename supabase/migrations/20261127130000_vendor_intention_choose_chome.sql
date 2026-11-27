-- 出店意向調査を「丁目 → 場所」の順にする。丁目だけでも回答できる。
--
-- 出店者はまず丁目（1〜7）を選ぶ。場所（地図の点＝区画）は任意で、選んだときだけ place_id を入れる。
-- 既存の回答は、場所から丁目を引けるものだけ丁目を入れる（既存の place_id は残す）。
--
-- 注意: 本番に適用するのは人。適用前に、vendor_intention_responses の行数と、
-- 丁目が引けない行（chome が null で place_id がある行）の数を確かめること。

ALTER TABLE public.vendor_intention_responses
  ADD COLUMN IF NOT EXISTS chome smallint CHECK (chome BETWEEN 1 AND 7);

-- 既存の回答の丁目は、場所の丁目（market_locations.district）から埋める
UPDATE public.vendor_intention_responses r
SET chome = public.normalize_chome_number(ml.district)
FROM public.market_locations ml
WHERE ml.id = r.place_id
  AND r.chome IS NULL;

-- 丁目だけの回答を許すため、場所は任意にする
ALTER TABLE public.vendor_intention_responses
  ALTER COLUMN place_id DROP NOT NULL;

-- 丁目は必ず入る（既存行の丁目が引けない場合は、移行を止めて確かめる）
ALTER TABLE public.vendor_intention_responses
  ALTER COLUMN chome SET NOT NULL;

-- 場所を入れるときは、その丁目と同じ丁目の場所にする（丁目の不一致を防ぐ）は API 層で確かめる
CREATE INDEX IF NOT EXISTS vendor_intention_responses_chome_idx ON public.vendor_intention_responses (season_year, chome);

COMMENT ON COLUMN public.vendor_intention_responses.chome IS '出店したい丁目（1〜7）。必ず入る。';
COMMENT ON COLUMN public.vendor_intention_responses.place_id IS '出店したい場所（market_locations）。任意。';
COMMENT ON TABLE public.vendor_intention_responses IS
  '出店意向調査の回答（季節×店舗で1行）。出店したい丁目（必須）と場所（任意）を持つ。市役所には店舗ごとの行を返さず、丁目・場所ごとの件数だけを返す。読み書きは service_role のみ。';
