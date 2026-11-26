-- 出店意向調査を「出店したい場所」だけに絞る。
--
-- 区画数・出店の頻度・出たい月・ひとこと は、この調査では使わないので列ごと消す。
-- 出店したい場所は、既存の出店場所（market_locations。地図の区画番号）から1つ選ぶ。
--
-- 注意: 既存の回答は、消した列の値が無いと意味を持たないため、ここで消す（受付期間の行は残す）。
-- 本番に適用するのは人。適用前に、vendor_intention_responses に残すべき行が無いことを確かめること。

DELETE FROM public.vendor_intention_responses;

ALTER TABLE public.vendor_intention_responses
  DROP COLUMN IF EXISTS booth_count,
  DROP COLUMN IF EXISTS frequency,
  DROP COLUMN IF EXISTS preferred_months,
  DROP COLUMN IF EXISTS note;

ALTER TABLE public.vendor_intention_responses
  ADD COLUMN place_id uuid NOT NULL REFERENCES public.market_locations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS vendor_intention_responses_place_idx ON public.vendor_intention_responses (season_year, place_id);

COMMENT ON TABLE public.vendor_intention_responses IS
  '出店意向調査の回答（季節×店舗で1行）。出店したい場所（market_locations）を1つ選ぶ。市役所には店舗ごとの行を返さず、場所ごとの件数だけを返す。読み書きは service_role のみ。';
