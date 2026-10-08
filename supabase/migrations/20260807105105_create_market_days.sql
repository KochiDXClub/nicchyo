-- 日曜市の開催ステータスを日付単位で管理するテーブル
-- 「今週やるのか / 荒天中止か」を運営・市役所がワンタップで更新し、
-- マップと近況ページの最上部バーに即時反映するために使う。
--
-- market_events（単発イベント告知）とは責務が異なるため別テーブルにする：
--   market_events … 「その日に何があるか」（1日に複数件ありうる）
--   market_days   … 「その日に開催するか」（1日に1件だけ）

CREATE TABLE IF NOT EXISTS market_days (
  market_date date        PRIMARY KEY,
  status      text        NOT NULL DEFAULT 'open',
  note        text,
  -- 「ワンタップで切り替える」運用では upsert による上書きが常態のため、
  -- 作成者ではなく最終更新者を持つ（created_by だと初回作成者が毎回潰れて名前と実態がずれる）
  updated_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_days_status_check
    CHECK (status IN ('open', 'cancelled', 'special', 'closed'))
);

COMMENT ON TABLE  market_days IS '日曜市の開催ステータス（1日1件）。開催可否の権威ソース。';
COMMENT ON COLUMN market_days.status IS 'open=通常開催 / cancelled=荒天中止 / special=特別開催 / closed=臨時休市';
COMMENT ON COLUMN market_days.note IS 'バーに添える一言（例：「雨天のため中止します」）。行を保存した時点で即公開される（下書き概念なし）。';
COMMENT ON COLUMN market_days.updated_by IS '最後にステータスを切り替えた管理者。公開列ではない。';

-- 直近の日付を引く用途しかないため、日付降順の索引だけ用意する
CREATE INDEX IF NOT EXISTS market_days_date_idx ON market_days(market_date DESC);

ALTER TABLE market_days ENABLE ROW LEVEL SECURITY;

-- 開催可否は誰でも知る必要がある情報なので、下書き概念を持たせず全件公開する
-- （出す＝公開。非公開にしたい場合は行を作らなければよい）
CREATE POLICY "market_days_select_public"
  ON market_days FOR SELECT
  USING (true);

-- 作成・更新・削除は管理者のみ
CREATE POLICY "market_days_insert_admin"
  ON market_days FOR INSERT
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

CREATE POLICY "market_days_update_admin"
  ON market_days FOR UPDATE
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

CREATE POLICY "market_days_delete_admin"
  ON market_days FOR DELETE
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- updated_at 自動更新（market_events と同じ方式）
CREATE OR REPLACE FUNCTION update_market_days_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS market_days_updated_at_trigger ON market_days;
CREATE TRIGGER market_days_updated_at_trigger
  BEFORE UPDATE ON market_days
  FOR EACH ROW EXECUTE FUNCTION update_market_days_updated_at();

-- 公開するのは「いつ・どうなるか」だけ。updated_by（管理者の auth.users UUID）は
-- PostgREST 経由で anon から直接読めてしまうため、列単位で GRANT して除外する。
-- 参照側（lib/market/calendar.ts）は列を明示指定しているので select=* には依存しない。
REVOKE SELECT ON public.market_days FROM anon, authenticated;
GRANT SELECT (market_date, status, note, updated_at) ON public.market_days TO anon;
GRANT SELECT (market_date, status, note, updated_at) ON public.market_days TO authenticated;

-- 目的：日曜市カレンダー（docs/discussion-market-calendar.md）フェーズ1。
-- 開催ステータスをマップ・近況ページ最上部の1行バーで発信できるようにする。
