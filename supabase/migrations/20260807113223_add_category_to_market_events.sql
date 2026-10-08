-- market_events に種別・写真・見どころフラグを追加する。
--
-- 日曜市カレンダーを「イベントの一覧」ではなく「日曜ごとのカード」で見せるため、
-- 1件ずつが何の情報なのか（出店予定 / イベント / 旬 / お知らせ）を区別できるようにする。
-- 元テーブルのコメント（「特別出店・イベント・告知などの情報を管理する」）にある
-- 3種類を、旬を加えて明示的な列にしたもの。

ALTER TABLE market_events
  ADD COLUMN IF NOT EXISTS category     text    NOT NULL DEFAULT 'event',
  -- 「写真が一番」という出店者インタビューの声に応えるが、無くても成立させる（任意）
  ADD COLUMN IF NOT EXISTS image_url    text,
  -- その日の「見どころ」。1日1件だけカードの主役として大きく出す
  ADD COLUMN IF NOT EXISTS is_highlight boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'market_events_category_check'
  ) THEN
    ALTER TABLE market_events
      ADD CONSTRAINT market_events_category_check
      CHECK (category IN ('vendor', 'event', 'season', 'notice'));
  END IF;
END $$;

COMMENT ON COLUMN market_events.category IS
  'vendor=出店予定 / event=イベント / season=旬のおすすめ / notice=お知らせ';
COMMENT ON COLUMN market_events.image_url IS
  'カードに添える写真（任意）。無い場合はテキストのみで表示する。';
COMMENT ON COLUMN market_events.is_highlight IS
  'その日の見どころ。1日1件だけ true にできる（部分ユニーク索引で担保）。';

-- 見どころは1日1件に限る。複数あると「今日は何が目玉か」が伝わらなくなるため。
CREATE UNIQUE INDEX IF NOT EXISTS market_events_highlight_per_day_idx
  ON market_events(event_date)
  WHERE is_highlight;

-- 種別で絞り込む一覧を想定した索引
CREATE INDEX IF NOT EXISTS market_events_category_idx ON market_events(category);

-- 目的：日曜市カレンダー（docs/discussion-market-calendar.md）フェーズ1.5。
-- カレンダーを日曜単位のカードにし、出店予定・イベント・旬を1枚にまとめて見せる。
