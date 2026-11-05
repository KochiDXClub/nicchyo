# /deploy-check — デプロイ状況を確認する

「本番に反映された？」「デプロイ状況」を聞かれたときに、Vercel とGitHub Actionsの状態を確認する。

## 実行手順

### 1. 最新の本番・プレビューを確認する
- Vercel の本番プロジェクトは `nicchyo`（`docs/RELEASE.md` §8）
- Vercel MCP で本番の最新デプロイの状態（Ready / Error / Building）と commit を確認する
- 失敗していたら、ビルドログを見て原因を報告する（推測と観測を分けて書く）

### 2. DB マイグレーションの状態を確認する
```bash
gh run list --workflow=migrations-deploy.yml --limit 5
```
- 承認待ちなら、承認者に通知が必要と伝える（`production` Environment の Required reviewers）
- 直近の実行が失敗していれば、Step Summary の履歴乖離の案内を読む（`docs/RELEASE.md` §9）

### 3. develop と main の差を見る
```bash
git fetch origin main develop
git log --oneline origin/main..origin/develop
```
差があれば、まだ本番に出ていない変更の件数を報告する。リリースの手順は `docs/RELEASE.md` §4 に従う。

### 4. 報告する
- 本番に入っている commit、デプロイの状態、DB の適用状態を、それぞれ一行ずつ書く
- 確認できなかった項目は「未確認」と書き、理由を添える（推測で「反映済み」と書かない）
