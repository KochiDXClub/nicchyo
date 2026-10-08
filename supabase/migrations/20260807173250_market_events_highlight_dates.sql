-- market_events.is_highlight（boolean）を highlight_dates（date[]）に置き換える。
--
-- 連続開催の予定（event_date〜end_date）に is_highlight を立てると、
-- 期間内の「すべての日曜」が見どころ扱いになってしまい、
-- 「8月はずっと出店するが、見どころにしたいのは最初の週だけ」のような
-- 調整ができなかった。見どころにしたい日曜の日付を個別に持たせることで、
-- 期間の一部の週だけを見どころにできるようにする。
-- 単発イベントは highlight_dates = {event_date} の1件だけを持つ想定。

-- is_highlight に依存していた部分インデックスを先に外す
DROP INDEX IF EXISTS market_events_highlight_per_day_idx;

ALTER TABLE market_events
  DROP COLUMN IF EXISTS is_highlight;

ALTER TABLE market_events
  ADD COLUMN IF NOT EXISTS highlight_dates date[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN market_events.highlight_dates IS
  '見どころにする日曜の日付（複数可）。空配列なら見どころではない。';

-- 「その日曜はもう他の予定が見どころになっていないか」を overlaps（&&）で
-- 調べる際に使う。1日1件の重複チェックはアプリ側（API）で行う
-- （地理的に1組織・低頻度更新の管理画面のため、DB制約までは持たせない）。
CREATE INDEX IF NOT EXISTS market_events_highlight_dates_gin_idx
  ON market_events USING GIN (highlight_dates);

-- 列単位 GRANT（20260807123500）を is_highlight → highlight_dates に更新する。
-- is_highlight 列は既に削除済みなので、この GRANT では新しい列一式を指定し直す。
GRANT SELECT (
  id, title, description, event_date, end_date, start_time, end_time,
  location, is_published, category, image_url, highlight_dates, created_at, updated_at
) ON public.market_events TO anon;

GRANT SELECT (
  id, title, description, event_date, end_date, start_time, end_time,
  location, is_published, category, image_url, highlight_dates, created_at, updated_at
) ON public.market_events TO authenticated;

-- 目的：日曜市カレンダー（docs/discussion-market-calendar.md）。
-- 見どころを「連続開催イベント全体」ではなく「特定の週」に付けられるようにする。
