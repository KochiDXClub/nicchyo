-- 出店者が「自分の投稿への」ハートリアクションを閲覧できるようにする
-- （出店者アナリティクスのハート集計用）。
--
-- 書き込み系（INSERT/UPDATE/DELETE）のポリシーは引き続き付けない。
-- ハートの付与・削除はサーバーのサービスロール経由
-- （/api/stories/[id]/reactions）のみで、件数改ざんを防ぐ設計は維持する。

DROP POLICY IF EXISTS "vendors can read reactions on own contents" ON content_reactions;

CREATE POLICY "vendors can read reactions on own contents"
  ON content_reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM vendor_contents vc
      WHERE vc.id = content_reactions.vendor_content_id
        AND vc.vendor_id = auth.uid()
    )
  );
