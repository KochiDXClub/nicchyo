-- 出店者の「出店しない日（休業日）」を保存する列を vendors に追加する。
-- 日曜市は毎週日曜開催のため、主に休む日曜の日付を配列で保持する。
-- 既存の行単位 UPDATE RLS で出店者は自分の行を更新できるため、新規ポリシーは不要。

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS closed_dates date[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN vendors.closed_dates IS
  '出店しない日（休業日）の日付配列。出店者がマイ店舗のカレンダーで設定する。';
