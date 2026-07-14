-- 日曜市イベント管理テーブル
-- 特別出店・イベント・告知などの情報を管理する

CREATE TABLE IF NOT EXISTS market_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text        NOT NULL,
  description  text,
  event_date   date        NOT NULL,
  start_time   time,
  end_time     time,
  location     text,
  is_published boolean     NOT NULL DEFAULT false,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_events_date_idx       ON market_events(event_date DESC);
CREATE INDEX IF NOT EXISTS market_events_published_idx  ON market_events(is_published);

ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;

-- 公開イベントは誰でも参照可
CREATE POLICY "market_events_select_public"
  ON market_events FOR SELECT
  USING (is_published = true);

-- 管理者は全件参照可
CREATE POLICY "market_events_select_admin"
  ON market_events FOR SELECT
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
    IN ('admin', 'super_admin', 'moderator')
  );

-- 管理者のみ作成・更新・削除可
CREATE POLICY "market_events_write_admin"
  ON market_events FOR INSERT
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
    IN ('admin', 'super_admin')
  );

CREATE POLICY "market_events_update_admin"
  ON market_events FOR UPDATE
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
    IN ('admin', 'super_admin')
  );

CREATE POLICY "market_events_delete_admin"
  ON market_events FOR DELETE
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
    IN ('admin', 'super_admin')
  );

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_market_events_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER market_events_updated_at_trigger
  BEFORE UPDATE ON market_events
  FOR EACH ROW EXECUTE FUNCTION update_market_events_updated_at();

GRANT SELECT ON public.market_events TO anon;
GRANT SELECT ON public.market_events TO authenticated;
