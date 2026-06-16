# コントリビューションガイド

nicchyo-platform への参加ありがとうございます。このガイドに沿って開発を進めてください。

---

## 環境構築

### 1. リポジトリのクローン

```bash
git clone https://github.com/KochiDXClub/nicchyo.git
cd nicchyo-platform
```

### 2. Node.js のバージョン確認

`.nvmrc` に記載のバージョンを使用してください。

```bash
nvm use  # または node -v で 24.x であることを確認
```

### 3. 依存パッケージのインストール

```bash
npm install
```

Husky（コミット前チェック）も自動でセットアップされます。

### 4. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local` を開き、各変数を設定してください（管理者に値を確認）。

### 5. Supabase のローカル起動

```bash
npx supabase start
```

起動後に表示される `API URL` と `anon key` を `.env.local` に設定してください。

### 6. 本番データをローカルに流し込む

マップにお店データを表示するため、本番 Supabase のデータをローカルにコピーします。

**事前準備**: `.env.local.production`（本番接続情報）をチームメンバーから入手してプロジェクトルートに置いてください。

```bash
npm run db:seed
```

詳細は [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) を参照してください。

### 7. 開発サーバーの起動

```bash
npm run dev
```

---

## ブランチ運用ルール

| ブランチ | 用途 |
|----------|------|
| `main` | 本番リリース済みコード |
| `develop` | 開発の集約ブランチ（PRのマージ先） |
| `feature/*` | 新機能開発 |
| `fix/*` | バグ修正 |
| `chore/*` | ライブラリ更新・設定変更など |

### ブランチ命名規則

```
feature/機能名         # 例: feature/coupon-history
fix/バグの内容         # 例: fix/map-marker-overlap
chore/作業内容         # 例: chore/update-dependencies
```

---

## 開発フロー

```
1. develop から作業ブランチを切る
   git switch develop && git pull origin develop
   git switch -c feature/your-feature

2. 実装する

3. ビルドを確認する（PR前に必須）
   npm run build

4. コミットする（pre-commit でlint + 型チェックが自動実行）
   git add <files>
   git commit -m "機能名を追加"

5. develop に向けて PR を出す
```

---

## コミットメッセージ規則

- **日本語**で書く
- 何をしたか（動詞＋目的語）を明確に

```
# 良い例
クーポン一覧ページを追加
マップのズーム時のマーカー重なりを修正
依存パッケージを最新版に更新

# 避ける例
fix bug
update
WIP
```

---

## PR のルール

- **必ず `develop` ブランチに向ける**（`main` に直接出さない）
- PR テンプレートの項目をすべて記入する
- **`npm run build` が通ることを確認してから出す**
- レビュアーを最低1名アサインする
- スクリーンショットがあると助かります（UI変更の場合）

---

## コーディング規約

- **ルート（URL）**: `kebab-case`
- **Reactコンポーネント**: `PascalCase`
- **変数・関数**: `camelCase`
- クライアントコンポーネントは先頭に `"use client"` を明示する
- ページ固有のコンポーネントはそのページの `components/` 内に置く
- 共通UIは `components/ui/`（Radix UIベース）

### Tailwind カラーパレット

独自パレットを使用してください（ハードコードのカラーコードは使わない）。

| トークン | 色 | 用途 |
|----------|----|------|
| `nicchyo-base` | `#FFFAF0` | 背景・クリーム |
| `nicchyo-primary` | `#7ED957` | メイン緑 |
| `nicchyo-accent` | `#FFDE59` | アクセント黄 |
| `nicchyo-ink` | `#3A3A3A` | テキスト |
| `nicchyo-soft-green` | `#A0D7A7` | 淡い緑 |

---

## コマンド一覧

```bash
npm run dev          # 開発サーバー起動
npm run build        # 本番ビルド（型チェック込み）
npm run lint         # ESLint
npm test             # Vitest テスト実行
npx tsc --noEmit     # 型チェックのみ
npx supabase start   # Supabase ローカル起動
npm run db:seed      # 本番データをローカルDBに流し込む
```

---

## テスト

- テストファイルは対象ファイルと同じディレクトリ、または `__tests__/` に置く
- ファイル名は `*.test.ts` / `*.test.tsx`
- テストフレームワーク: Vitest + React Testing Library

```bash
npm test                                    # 全テスト実行
npx vitest run lib/favoriteShops.test.ts   # 単一ファイル実行
```

---

## 困ったときは

- GitHub Issues でバグ報告・機能要望を受け付けています
- テンプレートを使って報告してください
