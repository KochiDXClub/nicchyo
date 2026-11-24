-- 出店意向調査（来季の出店の希望を、出店者ごとに集める）。
--
-- vendor_intention_seasons … 調査を開く季節（受付期間）。運営が行を入れる。
-- vendor_intention_responses … 出店者の回答。1季節1店舗1行。出店者は受付期間中だけ書き直せる。
--
-- 読み書きはすべてサーバーの service_role 経由（API 層で店舗の権限を確かめる）。
-- 市役所に見せるのは集計だけで、店舗ごとの回答は API から返さない（集計 API は件数だけを返す）。
-- 直接のアクセスは許可しない（vendor_notices と同じ形）。

CREATE TABLE IF NOT EXISTS public.vendor_intention_seasons (
  season_year smallint PRIMARY KEY CHECK (season_year BETWEEN 2000 AND 2100),
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  opens_on    date        NOT NULL,
  closes_on   date        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_on >= opens_on)
);

CREATE TABLE IF NOT EXISTS public.vendor_intention_responses (
  season_year      smallint    NOT NULL REFERENCES public.vendor_intention_seasons(season_year) ON DELETE CASCADE,
  vendor_id        uuid        NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  -- 希望の区画数（1〜3）。値域は lib/vendor/intention.ts と揃える
  booth_count      smallint    NOT NULL CHECK (booth_count BETWEEN 1 AND 3),
  -- 出店の頻度（lib/vendor/intention.ts の INTENTION_FREQUENCIES と揃える）
  frequency        text        NOT NULL CHECK (frequency IN ('weekly', 'twice_monthly', 'monthly', 'seasonal', 'undecided')),
  -- 出られたい月（1〜12）。空配列は「まだ決めていない」
  preferred_months smallint[]  NOT NULL DEFAULT '{}' CHECK (preferred_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
  note             text        CHECK (note IS NULL OR char_length(note) <= 200),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_year, vendor_id)
);

CREATE INDEX IF NOT EXISTS vendor_intention_responses_season_idx ON public.vendor_intention_responses (season_year);

ALTER TABLE public.vendor_intention_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_intention_responses ENABLE ROW LEVEL SECURITY;

-- Supabase は新しいテーブルに anon / authenticated の全権限を付けるので、すべて剥がす（ポリシーは作らない）。
REVOKE ALL ON public.vendor_intention_seasons FROM anon, authenticated;
REVOKE ALL ON public.vendor_intention_responses FROM anon, authenticated;

COMMENT ON TABLE public.vendor_intention_seasons IS
  '出店意向調査の受付期間（季節ごと）。opens_on〜closes_on（日本時間の日付）の間だけ出店者が回答・変更できる。読み書きは service_role のみ。';
COMMENT ON TABLE public.vendor_intention_responses IS
  '出店意向調査の回答（季節×店舗で1行）。市役所には店舗ごとの行を返さず、集計だけを返す。読み書きは service_role のみ。';
