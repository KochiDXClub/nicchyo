-- 出店者ストーリー（週次リセット写真投稿）テーブル
CREATE TABLE shop_stories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   TEXT        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  image_url   TEXT        NOT NULL,
  caption     TEXT,
  posted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- expires_at は投稿日の翌日曜日23:59:59 JST に設定する想定
-- アプリ側またはトリガーで計算して挿入する

CREATE INDEX idx_shop_stories_expires  ON shop_stories(expires_at);
CREATE INDEX idx_shop_stories_vendor   ON shop_stories(vendor_id);
CREATE INDEX idx_shop_stories_posted   ON shop_stories(posted_at DESC);

ALTER TABLE shop_stories ENABLE ROW LEVEL SECURITY;

-- 有効期限内のストーリーは誰でも読める
CREATE POLICY "stories_public_read" ON shop_stories
  FOR SELECT USING (expires_at > NOW());

-- 認証済みユーザー（出店者）のみ投稿可能
-- 本格的なオーナー検証は vendor_id チェックで行う
CREATE POLICY "stories_vendor_insert" ON shop_stories
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "stories_vendor_delete" ON shop_stories
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM vendors WHERE id = vendor_id
    )
  );
