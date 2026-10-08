-- market_events に「いつまで連続で開催するか」を追加する。
--
-- 日曜市は毎週日曜開催なので、「文旦フェア（8/16〜9/6の4回）」のように
-- 複数の日曜にまたがる予定がある。1回ごとに行を作らせると入稿の手間が増えるため、
-- 開始日（event_date）と終了日（end_date）で期間を表す。
--
-- end_date が NULL のときはその日限りの予定として扱う。

ALTER TABLE market_events
  ADD COLUMN IF NOT EXISTS end_date date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'market_events_end_date_check'
  ) THEN
    ALTER TABLE market_events
      ADD CONSTRAINT market_events_end_date_check
      CHECK (end_date IS NULL OR end_date >= event_date);
  END IF;
END $$;

COMMENT ON COLUMN market_events.end_date IS
  '連続開催の最終日。NULL ならその日限り。event_date 以降であることを制約で担保。';

-- 「今日以降に掛かっている予定」を引くための索引
CREATE INDEX IF NOT EXISTS market_events_end_date_idx ON market_events(end_date);

-- 目的：日曜市カレンダー（docs/discussion-market-calendar.md）フェーズ1.5。
-- 1件の予定を複数の日曜にまたがって表示できるようにする。
