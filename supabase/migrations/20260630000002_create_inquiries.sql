-- 問い合わせ管理テーブル
-- /contact フォームから送信された問い合わせを保存する

CREATE TABLE IF NOT EXISTS inquiries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text,                   -- 氏名（任意）
  email        text        NOT NULL,
  category     text        NOT NULL DEFAULT 'general',  -- 'question' | 'feedback' | 'bug' | 'other'
  message      text        NOT NULL,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  status       text        NOT NULL DEFAULT 'open',  -- 'open' | 'in_progress' | 'resolved' | 'closed'
  assigned_to  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reply_notes  text,                   -- 内部対応メモ
  replied_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  replied_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS inquiries_status_idx     ON inquiries(status);
CREATE INDEX IF NOT EXISTS inquiries_category_idx   ON inquiries(category);
CREATE INDEX IF NOT EXISTS inquiries_created_at_idx ON inquiries(created_at DESC);

-- RLS 有効化
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- 誰でも問い合わせ投稿可（フォームからの送信）
CREATE POLICY "inquiries_insert_anyone"
  ON inquiries FOR INSERT
  WITH CHECK (true);

-- 管理者・モデレーターのみ参照可
CREATE POLICY "inquiries_select_admin"
  ON inquiries FOR SELECT
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
    IN ('admin', 'super_admin', 'moderator')
  );

-- 管理者・モデレーターのみ更新可
CREATE POLICY "inquiries_update_admin"
  ON inquiries FOR UPDATE
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
    IN ('admin', 'super_admin', 'moderator')
  );

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_inquiries_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inquiries_updated_at_trigger
  BEFORE UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION update_inquiries_updated_at();

-- anon・authenticated ロールへの権限付与
GRANT INSERT ON public.inquiries TO anon;
GRANT INSERT ON public.inquiries TO authenticated;
