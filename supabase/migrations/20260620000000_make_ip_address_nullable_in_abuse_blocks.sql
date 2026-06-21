-- ip が取得できない環境（リバースプロキシ設定等）では null になるため、
-- NOT NULL 制約を外して visitor_key のみでのブロックに対応する
ALTER TABLE ai_abuse_blocks
  ALTER COLUMN ip_address DROP NOT NULL;
