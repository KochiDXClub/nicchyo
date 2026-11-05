# nicchyo-platform 残タスク・既知の問題

最終更新: 2026-03-22

---

## 完了済みの対応

### セキュリティ修正（SQL）
- `vendors.role` の自己昇格バグ修正（出店者が自分を管理者にできた問題）
- `vendor_embeddings` テーブルにRLSを追加（誰でも読み書きできた問題）
- `super_admin` ロールが統計テーブルを参照できない問題を修正

### セキュリティ修正（コード）
- `/api/map-agent` にIPレートリミット追加（10回/10分）
- アナリティクスAPIにクールダウン追加（短時間の重複リクエスト防止）
- AIナレッジAPIに5000文字制限を追加
- 管理者一括操作APIに200件上限・自分自身への操作禁止を追加
- AIばあちゃんのIPスプーフィング対策（`x-real-ip` ヘッダーを優先使用）

### パフォーマンス改善（SQL）
- 頻繁に参照されるカラムへのインデックス追加
  - `vendors.role`、`vendors.category_id`
  - `vendor_contents.vendor_id`、`vendor_contents.expires_at`
  - `location_assignments.vendor_id`、`location_assignments.market_date`
  - `shop_page_views.vendor_id`、`shop_page_views.viewed_at`

### データ整合性（SQL）
- `store_knowledge.store_id` を TEXT → UUID に変更し外部キー制約を追加
  - 出店者削除時に紐づく知識データも自動削除されるように

### 管理画面の実装
- ユーザー管理の一括操作（停止・復帰・削除）を実際のAPIに接続
- ユーザー管理の個別操作（停止・復帰・ロール変更）を実際のAPIに接続
- 設定ページの危険ゾーン（マップ履歴整理・分析ログ削除）を有効化

---

## 残っている作業

### 🔴 優先度：高（セキュリティ）

#### アナリティクスの直接INSERT閉鎖（コード対応済み・適用確認待ち）
- `shop_page_views` は `20261002100000_lock_shop_page_views_writes.sql` で対応済み。
- `web_page_analytics` は閲覧ログAPIのservice role保存と `20261104110000_close_web_analytics_direct_insert.sql` で対応。
- 新しいSQLとアプリの適用後に、`supabase/checks/web_analytics_writes.sql` と実画面の記録を確認する。未適用の本番まで解消済みとは扱わない。

---

### 🟠 優先度：中（データ整合性）

#### `ai_consult_logs` 外部キー追加（SQL Editorで実行）
- **問題**: `ai_consult_logs.store_id` がTEXT型で外部キー制約がなく、出店者削除後に孤立レコードが残る
- **事前確認**:
  ```sql
  SELECT policyname FROM pg_policies WHERE tablename = 'ai_consult_logs';
  ```
- **対応手順**: `store_knowledge` と同じ手順（ポリシー削除→型変換→再作成→外部キー追加）

---

### 🟡 優先度：中（運用）

#### ログテーブルの自動クリーンアップ
- **問題**: 以下のテーブルに自動削除の仕組みがなく、長期運用で数百万行になる恐れがある
  - `web_page_analytics`（ページ訪問ごとに1行）
  - `shop_page_views`（店舗ページ閲覧ごとに1行）
  - `ai_consult_logs`（AI相談ごとに1行）
  - `product_search_logs`（検索ごとに1行）
- **対応方針（どちらか選択）**:
  - A. **Vercel Cron Jobs**: `vercel.json` にスケジュール追加し、APIルートを定期実行
  - B. **手動クリーンアップ**: 管理画面の設定ページ危険ゾーンに「N日より古いデータを削除」ボタンを追加

---

### 🟡 優先度：中（未実装機能）

| ページ / 機能 | 問題 | 対応方針 |
|---|---|---|
| `/admin/events` | ページ全体がプレースホルダー（「実装予定」テキストのみ） | 不要なら削除、必要なら実装 |
| `/admin/users` → 新規追加ボタン | クリックしても「未実装」トーストが出るだけ | 実装するか非表示にする |
| `/admin/notifications` | メール通知が未実装 | Resend等の外部サービス導入が必要 |
| `/my-shop/contents` | 出店者向けコンテンツページがプレースホルダー | 投稿フォームを実装予定 |

---

### 🔵 優先度：低（将来的な改善）

#### Vercel Preview デプロイがアナリティクスを汚染する可能性
- **問題**: Vercelのプレビューデプロイが本番のSupabaseを向いている場合、開発中のアクセスが本番データに混入する
- **対応**: Vercel設定で `NEXT_PUBLIC_SUPABASE_URL` を「Production環境のみ」に制限する

#### AI検索インデックスの精度問題
- **問題**: `vendor_embeddings` のIVFFlatインデックスが `lists=100` で設定されているが、出店者数が1000未満の場合は精度が劣化する
- **対応**: 出店者数が増えたタイミングで `REINDEX` を実行する

#### AIばあちゃんの誤検知
- **問題**: SQLインジェクション検知が「selectする」「orが含まれる」など正常な日本語の質問を誤ってブロックする可能性がある
- **対応**: 検知パターンを日本語コンテキストに合わせて調整する

---

## 開発環境について

| 項目 | 内容 |
|---|---|
| ローカルSupabase起動 | `npx supabase start` |
| 本番環境変数 | `.env.local.production` にバックアップ済み |
| TypeScriptチェック | `npx tsc --noEmit` |
| メインブランチ | `main` |
| 現在の作業ブランチ | `feature/admin-panel` |

> **注意**: ローカル開発サーバーで投稿・操作を行ってもローカルのSupabaseにのみ保存され、本番DBには反映されません。本番の動作確認はVercelデプロイ済みのURLから行ってください。
