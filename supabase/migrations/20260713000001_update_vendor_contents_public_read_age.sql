-- 近況（ストーリー）を「褪せていくタイムライン」として表示するための RLS 更新。
--
-- これまで公開読み取りポリシー "public can read active contents" は
--   USING (expires_at > now() AND status = 'active')
-- だったため、期限切れ（expires_at <= now()）の投稿は anon クライアントから
-- 一切読めなかった。vendor 投稿の expires_at は「今日」「3日」「1週間」等の
-- プリセットで通常1〜2週間以内に切れるため、「1週間前」「1か月前」バケットに
-- 入るはずの投稿の大半が RLS で弾かれ、褪色タイムラインが機能しなかった。
--
-- 公開範囲を expires_at ではなく created_at 基準（過去31日・status='active'）に
-- 変更し、アプリ側（app/api/stories/route.ts）の created_at フィルタと一致させる。
-- なお shopDb.ts / vendorSearch.ts など「現在有効な投稿のみ」を必要とする箇所は
-- アプリ側で明示的に expires_at > now() を掛けているため、本変更の影響を受けない。

ALTER POLICY "public can read active contents"
  ON vendor_contents
  USING (created_at > now() - interval '31 days' AND status = 'active');

-- created_at による絞り込み・並び替えが公開読み取りの主経路になるため index を追加。
CREATE INDEX IF NOT EXISTS vendor_contents_created_at_idx
  ON vendor_contents(created_at);
