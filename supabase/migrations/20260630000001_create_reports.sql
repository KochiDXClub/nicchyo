-- 通報管理テーブル
-- 誤情報・不適切コンテンツ等の通報を受け付ける汎用テーブル
-- target_type を拡張することで将来のUGC（レビュー等）にも対応可能

CREATE TABLE IF NOT EXISTS reports (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type      text        NOT NULL,   -- 'vendor' | 'content' | 'kotodute'
  target_id        text        NOT NULL,
  target_name      text,                   -- 表示用の対象名（検索用）
  reason           text        NOT NULL,   -- 通報理由カテゴリ
  details          text,                   -- 詳細説明（任意）
  reporter_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_email   text,                   -- 非ログイン通報時も記録
  status           text        NOT NULL DEFAULT 'open',  -- 'open' | 'in_review' | 'resolved' | 'dismissed'
  resolved_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at      timestamptz,
  resolution_notes text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS reports_status_idx      ON reports(status);
CREATE INDEX IF NOT EXISTS reports_target_type_idx ON reports(target_type);
CREATE INDEX IF NOT EXISTS reports_created_at_idx  ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS reports_target_id_idx   ON reports(target_type, target_id);

-- RLS 有効化
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 誰でも通報を投稿可（匿名通報を許可）
CREATE POLICY "reports_insert_anyone"
  ON reports FOR INSERT
  WITH CHECK (true);

-- 管理者・モデレーターのみ参照可
CREATE POLICY "reports_select_admin"
  ON reports FOR SELECT
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
    IN ('admin', 'super_admin', 'moderator')
  );

-- 管理者・モデレーターのみ更新可（ステータス変更・対応メモ）
CREATE POLICY "reports_update_admin"
  ON reports FOR UPDATE
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
    IN ('admin', 'super_admin', 'moderator')
  );

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reports_updated_at_trigger
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_reports_updated_at();

-- anon・authenticated ロールへの権限付与
GRANT INSERT ON public.reports TO anon;
GRANT INSERT ON public.reports TO authenticated;
