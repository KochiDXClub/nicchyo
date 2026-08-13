# /ship — PR 提出前の最終チェック

ビルド・品質・セキュリティをすべて確認し、PR 説明草案を生成する。

## 実行手順

### 1. console.log 残留チェック
```bash
git diff $(git merge-base HEAD origin/develop) HEAD -- '*.ts' '*.tsx' | grep '^\+' | grep -v '^\+\+\+' | grep 'console\.log' || echo "console.log: なし"
```

### 2. 型チェック
```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E 'error TS' | head -10 || echo "型エラー: なし"
```

### 3. Lint
```bash
npm run lint 2>&1 | tail -15
```

### 4. テスト
```bash
npm test 2>&1 | tail -10
```

### 5. ビルド
```bash
npm run build 2>&1 | tail -20
```

### 6. 変更ファイル数（10 件以内推奨）
```bash
git diff --stat $(git merge-base HEAD origin/develop) HEAD
```

### 7. コミット一覧
```bash
git log --oneline $(git merge-base HEAD origin/develop)..HEAD
```

### 8. 未リリース変更の記録（docs/CHANGELOG-unreleased.md）

来訪者から見て何かが変わるPRの場合、`docs/CHANGELOG-unreleased.md` の「## 一覧」直下に1行追記する。

```markdown
- 日曜市カレンダーに出店予定と旬を表示するようにした (#PR番号)
```

- 書くのは**来訪者視点の一言**。実装の詳細は書かない（コミットに残る）。
- 来訪者に見えない変更（依存更新・テスト追加・リファクタ・ドキュメント）は追記しない。
- PR番号が未確定なら `(#TBD)` で入れて、PR作成後に差し替える。

この記録はリリース時に `app/about/versions.ts` へ転記される。詳細は `docs/RELEASE.md` §6。

### 9. レポート & PR 説明草案

上記の結果をもとに以下を出力すること：

**チェック結果:**
- ✅/❌ console.log 残留なし
- ✅/❌ 型チェック
- ✅/❌ Lint
- ✅/❌ テスト
- ✅/❌ ビルド
- 変更ファイル数（10 件超えなら分割を提案）
- ✅/➖ CHANGELOG-unreleased.md への追記（来訪者に見えない変更なら ➖）

**PR 説明草案（.github/pull_request_template.md の形式で）:**

```
## 概要
（コミット内容から自動生成）

## 主な変更
-
-

## 変更ファイル
| ファイル | 変更内容 |
|---|---|

## 確認してほしいこと
- [ ]

## 動作確認
- [ ] `npm run build` が通ることを確認した
- [ ] ローカルで動作確認した
- [ ] 関連するテストを追加・更新した（該当する場合）
```

すべて ✅ なら「出荷OK」と報告し、PR 説明草案を提示する。
❌ がある場合は修正を提案してから再チェックする。

CLAUDE.md 規則：1PR = 1目的、変更ファイル目安 10件以内。
