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
  ADD COLUMN IF NOT EXISTS sunday_love text,
  ADD COLUMN IF NOT EXISTS signature_product_name text,
  ADD COLUMN IF NOT EXISTS rain_answered_at timestamptz;

-- vendors は列単位の GRANT で公開列を絞っている
-- （20260807112200 / 20260807120000）。列を足しても権限は自動では増えないので、
-- 来訪者にも見せてよい新規列を明示的に許可する。これを忘れると、出店者本人の
-- 読み取りも permission denied になり、質問画面が開かなくなる。
GRANT SELECT (
  payment_note, rain_note, motivation, years_running, sunday_love,
  signature_product_name, rain_answered_at
) ON public.vendors TO anon, authenticated;

COMMENT ON COLUMN vendors.payment_note IS '決済方法の自由入力（選択肢にないもの）。';
COMMENT ON COLUMN vendors.rain_note IS '雨の日の出店についてのひとこと（rain_policy の補足）。';
COMMENT ON COLUMN vendors.motivation IS 'どんな思いで出店しているか。';
COMMENT ON COLUMN vendors.years_running IS '出店を続けてきた年数。';
COMMENT ON COLUMN vendors.sunday_love IS '日曜市の好きなところ。';
COMMENT ON COLUMN vendors.signature_product_name IS
  '看板商品の商品名。products のうち、この名前の行を看板商品として扱う。/my-shop/detail の保存は商品の行を入れ直して id が変わるため、id ではなく名前で持つ。';
COMMENT ON COLUMN vendors.rain_answered_at IS
  '雨の日の質問に答えた日時。rain_policy の既定値（当日判断）のままなのか、本人が当日判断を選んだのかを見分けるために持つ。';

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

-- 権限は標準の付与に頼らず明示する。匿名ユーザーは読み取りだけ、出店者は自分の行を
-- 読み書きできる（どの行に触れるかは、下の RLS が auth.uid() = vendor_id で絞る）。
-- Supabase は新しいテーブルに、標準で全権限（TRUNCATE を含む）を anon / authenticated へ付ける。
-- TRUNCATE は RLS を素通りして全員の行を消せるので、いったん剥がして必要な分だけ付け直す。
REVOKE ALL ON public.vendor_weekly_status FROM anon, authenticated;
GRANT SELECT ON public.vendor_weekly_status TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_weekly_status TO authenticated;

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

-- 商品写真を同じ名前で上書き保存（upsert）するには、Storage の UPDATE 権限が要る。
-- vendor-images には INSERT / SELECT / DELETE のポリシーしか無く、2回目の保存が
-- RLS 違反で失敗するため、自分のフォルダに限って追加する。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'vendors can update own images'
  ) THEN
    CREATE POLICY "vendors can update own images"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'vendor-images'
      AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
      bucket_id = 'vendor-images'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END;
$$;

-- 目的: 出店者ページを「にちよさんが質問してくる」形にするための保存先。
-- 回答を構造化データとして持ち、マップ・カレンダー・AI案内に反映できるようにする。
