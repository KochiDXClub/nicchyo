-- ストーリー（近況）へのハートリアクション
-- 匿名ユーザーが visitor_key 単位で 1 投稿につき 1 ハートを付けられる。
-- 乱用対策はアプリ層のレート制限 + same-origin チェック + unique 制約で担保する。

CREATE TABLE IF NOT EXISTS content_reactions (
  id                bigserial   PRIMARY KEY,
  vendor_content_id uuid        NOT NULL REFERENCES vendor_contents(id) ON DELETE CASCADE,
  visitor_key       text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_content_id, visitor_key)
);

CREATE INDEX IF NOT EXISTS content_reactions_content_idx ON content_reactions(vendor_content_id);

ALTER TABLE content_reactions ENABLE ROW LEVEL SECURITY;

-- 直接の匿名アクセスは許可しない（anon/authenticated への GRANT・ポリシーなし）。
-- 読み書きはすべてサーバー側のサービスロール経由（RLS をバイパス）で行い、
-- 乱用は API 層の same-origin チェック + レート制限 + unique 制約で担保する。
-- これにより公開 anon キーでの件数改ざん・全削除を防ぐ。
