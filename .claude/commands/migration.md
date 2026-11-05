# /migration — DB マイグレーションを書く

テーブル追加・カラム追加・ポリシー変更など、`supabase/migrations/` にSQLを書くときの手順。
適用は GitHub Actions（`docs/RELEASE.md` §9）が行うので、手で `supabase db push` は叩かない。

## 実行手順

### 1. 現状を確認する
- `supabase/migrations/` の最新ファイルを見て、既存の書き方（命名・権限・RLS）に揃える
- 既存テーブルを変えるなら、対象テーブルを作った最初のマイグレーションも読む
- 本番と履歴がずれていないか（`docs/RELEASE.md` §9）を、人が確認しているか気にかける

### 2. ファイルを作る
- 名前は `YYYYMMDDHHMMSS_説明.sql`（タイムスタンプは今日の日付、説明は英小文字とアンダースコア）
- 追加系を基本にする: `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`
- 後方互換を守る（旧コードでも動くこと）。カラム削除・リネーム・NOT NULL 追加は expand → contract で2リリースに分ける
- 破壊的な文（`DROP`・`DELETE FROM`・`TRUNCATE`・`REVOKE`）を含むなら、PR説明に明記し、`docs/RELEASE.md` §4.2 の一覧に載せる

### 3. 権限とRLSを確認する
- 新しいテーブルは RLS を有効にし、ポリシーを明示する（既定で公開しない）
- `anon` / `authenticated` への `GRANT` は必要な最小限にする
- 管理者機能なら、`security-reviewer` エージェントを呼ぶ（CLAUDE.md の自動起動ルール）

### 4. ローカルで検証する
```bash
npx supabase migration list          # 追加したファイルが Local に出ているか
```
ローカルの Supabase が無い環境では、CI の `migrations-check.yml` が2回適用・構文・順序を検証するので、PR を出して結果を見る。

### 5. 報告する
- 追加したファイル名、変更するテーブル・ポリシー、破壊的な文の有無を一言ずつ書く
- 本番データに影響するなら、事前確認SQL（`docs/RELEASE.md` §4.2）が要るかを伝える
