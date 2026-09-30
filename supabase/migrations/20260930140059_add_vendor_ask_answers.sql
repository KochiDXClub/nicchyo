-- 出店者ページの「にちよさんの質問」で集める回答の保存先を追加する。
--
-- 1. vendors に、選択式では拾えない補足と「マニアックな質問」の回答列を足す。
--    vendors は既に「公開読み取り＋本人のみ更新」の RLS があるため、新規ポリシーは不要。
--    （products.description は作成時から存在するので、商品のPRはそこへ保存する）
-- 2. vendor_weekly_status に、週ごとの出店状況と今週の商品を保存する（毎週の「いつもの質問」）。
--    日曜市は毎週日曜開催なので、週は「その週の日曜の日付」で表す。

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS payment_note text,
  ADD COLUMN IF NOT EXISTS rain_note text,
  ADD COLUMN IF NOT EXISTS motivation text,
  ADD COLUMN IF NOT EXISTS years_running integer,
  ADD COLUMN IF NOT EXISTS sunday_love text;

COMMENT ON COLUMN vendors.payment_note IS '決済方法の自由入力（選択肢にないもの）。';
COMMENT ON COLUMN vendors.rain_note IS '雨の日の出店についてのひとこと（rain_policy の補足）。';
COMMENT ON COLUMN vendors.motivation IS 'どんな思いで出店しているか。';
COMMENT ON COLUMN vendors.years_running IS '出店を続けてきた年数。';
COMMENT ON COLUMN vendors.sunday_love IS '日曜市の好きなところ。';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendors_years_running_range'
  ) THEN
    ALTER TABLE vendors
      ADD CONSTRAINT vendors_years_running_range
      CHECK (years_running IS NULL OR (years_running >= 0 AND years_running <= 100));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.vendor_weekly_status (
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  -- その週の日曜の日付（日曜市の開催日）
  week_date date NOT NULL,
  -- 今週出店するか。null は未回答
  is_open boolean,
  -- 今週出す商品名
  products text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vendor_id, week_date)
);

CREATE INDEX IF NOT EXISTS vendor_weekly_status_week_date_idx
  ON public.vendor_weekly_status (week_date);

ALTER TABLE public.vendor_weekly_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- マップ・カレンダーの表示に使うので、誰でも読める
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vendor_weekly_status'
      AND policyname = 'public can read vendor weekly status'
  ) THEN
    EXECUTE 'CREATE POLICY "public can read vendor weekly status" ON public.vendor_weekly_status FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vendor_weekly_status'
      AND policyname = 'vendors manage own weekly status'
  ) THEN
    EXECUTE 'CREATE POLICY "vendors manage own weekly status" ON public.vendor_weekly_status FOR ALL USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id)';
  END IF;
END;
$$;

-- 目的: 出店者ページを「にちよさんが質問してくる」形にするための保存先。
-- 回答を構造化データとして持ち、マップ・カレンダー・AI案内に反映できるようにする。
