# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**nicchyo（ニッチョ）** は、高知・日曜市（毎週日曜開催の大規模路上市場）を初来訪者に案内するデジタルマッププラットフォームです。インタラクティブ地図・AI案内・店舗検索が中心機能です。

## Commands

```bash
npm run dev        # 開発サーバー起動（ポート3000、使用中なら自動選択）
npm run build      # 本番ビルド（型チェックも実行）
npm run lint       # ESLint
npm test           # Vitestテスト実行（--passWithNoTests付き）
npx vitest run lib/favoriteShops.test.ts  # 単一テストファイルの実行
```

PRを出す前は必ず `npm run build` でビルドが通ることを確認する。

**PRは小さく出す**：チーム開発のためレビューしやすさを優先する。1PRは1つの目的（機能追加・バグ修正・リファクタを混在させない）。目安は変更ファイル10件以内。大きな作業は事前にサブタスクに分割してからPRを作成する。

## 技術的負債解消時の必須確認事項

技術的負債（リファクタ・コード整理・分割・移動）を行った場合、**機能的な欠陥を生んでいないか必ず確認する**こと。ビルドやlintが通っても、UIや動作が壊れている場合がある。

### 確認チェックリスト

1. **抽出・移動したコンポーネント・関数は元の実装と完全に一致しているか**
   - JSXの構造・CSSクラス・条件分岐・イベントハンドラをすべて比較する
   - 「似ている」ではなく「完全に同じ」であることを確認する

2. **削除・移動したコードが参照していた変数・型・インポートはすべて新しい場所に持ち込まれているか**
   - 元ファイルで暗黙的に参照していたスコープ外の変数に注意する

3. **props・インターフェースの変更がないか**
   - 不要なpropを削除した場合、呼び出し側で渡していた値が無視されるだけで壊れないか確認する
   - 追加が必要なpropを見落としていないか確認する

4. **ビルド・lint通過後も目視確認を行う**
   - `npm run build` と `npm run lint` はあくまで型とスタイルの確認。UIの見た目や動作の正しさは保証しない
   - 変更したコンポーネントが実際に表示される画面を開発サーバーで確認する（可能な場合）

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 18, TypeScript 5.9
- **Styling**: Tailwind CSS（カスタムパレット: `nicchyo-base/primary/accent/ink/soft-green`）
- **DB**: Supabase（メイン）、Prismaスキーマも存在
- **Map**: Leaflet + react-leaflet（`reactStrictMode: false` ← Leafletの二重初期化防止）
- **AI**: OpenAI API（RAG構成、`app/api/grandma/` と `app/api/map-agent/`）
- **Auth**: Supabase Auth（`lib/auth/AuthContext.tsx`）

## Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
# 互換用: NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
```

## Architecture

### ルーティング構造

```
app/
├── (public)/          # 一般ユーザー向けページ
│   ├── map/           # メイン地図ページ（主機能）
│   ├── search/        # 店舗検索
│   ├── bag/           # 買い物リスト
│   ├── consult/       # AI「にちよさん」チャット
│   ├── shops/[code]/  # 店舗詳細（コードは3桁ゼロ埋め: 001〜300）
│   ├── my-shop/       # 出店者向けページ
│   └── ...
├── private/           # 要認証ページ
├── admin/             # 管理者ページ
└── api/               # API Routes
    ├── shops/         # 店舗データ取得・編集
    ├── grandma/       # AI「にちよさん」バックエンド
    ├── map-agent/     # マップAIアシスタント
    ├── analytics/     # アクセス解析
    └── vendor/        # 出店者向けAPI
```

### グローバルContext（`app/layout.tsx` で提供）

| Context | ファイル | 役割 |
|---------|---------|------|
| `AuthProvider` | `lib/auth/AuthContext.tsx` | Supabase認証状態管理 |
| `BagProvider` | `lib/storage/BagContext.tsx` | 買い物リスト（ローカルストレージ） |
| `MenuProvider` | `lib/ui/MenuContext.tsx` | ナビゲーションメニュー開閉 |
| `MapLoadingProvider` | `app/components/MapLoadingProvider` | マップ初期ローディング状態 |

### マップページ構造 (`app/(public)/map/`)

マップは最も複雑なページ。レイヤー構造：

```
Layer 4: UI（ボタン・バナー・ズームコントロール）
Layer 3: 店舗層（ShopMarker, ShopBubble）
Layer 2: 道層（RoadOverlay, zIndex: 50）
Layer 1: 背景層（BackgroundOverlay, 現在無効）
Layer 0: Leafletベースマップ
```

- **座標の基準**: `config/roadConfig.ts` がすべての基準（高知城前〜追手筋東端）
- **店舗表示の間引き**: ズームレベルに応じて `utils/zoomCalculator.ts` が密度調整
- **データ取得**: `fetch-map-data.ts` でサーバーサイド取得 → `MapPageClient.tsx` に渡す
- **店舗DBアクセス**: `services/shopDb.ts`, `services/shopDataService.ts`

### 店舗コード体系

店舗IDは1〜300の整数。URLパラメータ・QRコードでは3桁ゼロ埋め文字列（`001`〜`300`）。変換は `lib/shops/route.ts` の `normalizeShopCodeToId` / `formatShopIdToCode` を使う。

`next.config.js` に `/shops001` → `/shops/001` のリライトルールあり。

### テスト

Vitest + jsdom + React Testing Library。テストファイルは対象ファイルと同階層か `__tests__/` に置く（例: `lib/favoriteShops.test.ts`）。カバレッジ対象は `lib/**` と `components/**`。

### Tailwindカラーパレット

```
nicchyo-base:       #FFFAF0  （背景・クリーム色）
nicchyo-primary:    #7ED957  （メイン緑）
nicchyo-accent:     #FFDE59  （アクセント黄）
nicchyo-ink:        #3A3A3A  （テキスト）
nicchyo-soft-green: #A0D7A7  （淡い緑）
```

## Coding Conventions

- ルート名: kebab-case、コンポーネント: PascalCase、変数/関数: camelCase
- クライアントコンポーネントには `"use client"` を明示
- ページ固有のコンポーネントはそのページディレクトリ内の `components/` に置く
- 共通UIコンポーネントは `components/ui/`（Radix UIベース）
- 管理画面コンポーネントは `components/admin/`
- ユーティリティ関数は `lib/utils/cn.ts`（`clsx` + `tailwind-merge` のラッパー）

## 重要な制約

- `reactStrictMode: false` は意図的（Leaflet互換性のため変更しない）
- Supabase Storageの画像URLは `*.supabase.co` ドメイン（`next.config.js` の `remotePatterns` に設定済み）

## スキルの積極活用（重要）

`.claude/commands/` にプロジェクト固有のスキルが定義されている。
**ユーザーが明示的に `/スキル名` と書かなくても**、タスクの意図がスキルの目的に合致する場合は自動的に起動すること。

### 起動トリガー一覧

| ユーザーの意図・キーワード | 起動するスキル |
|---|---|
| 「PRを出す」「PRを作る」「PRを提出」「マージしたい」 | `/ship` |
| 「コミットして」「コミットしたい」「変更を保存」 | `/commit` |
| 「デプロイ確認」「デプロイ状況」「本番に反映された？」 | `/deploy-check` |
| テーブル追加・カラム追加・DB変更・マイグレーション | `/migration <説明>` |
| 「ビルド確認」「型チェック」「lint確認」「エラー確認」 | `/check` |
| 「テストして」「テストを実行」 | `/test` |
| セキュリティ確認・RLSチェック・API認可レビュー | `security-reviewer` エージェント |
| 「新しいブランチで」「並行して開発」「worktree作って」 | `/worktree <名前>` |
| 「マップを確認」「マップ周辺のコード」 | `/map` |
| worktreeの後片付け・削除 | `/worktree-clean` |

### 判断手順

1. ユーザーのメッセージから「やろうとしていること」を特定する
2. 上の表と照合してスキルが使えるか判断する
3. 合致するスキルがあれば、他のことをする前にそのスキルを起動する
4. スキルの中に含まれる確認ステップはスキップしない

### 特に重要な自動起動

- コードを書き終えてPRを作ろうとしているなら、必ず `/ship` を先に通す
- `supabase/migrations/` にSQLを書くときは `/migration` を使う
- 新しいAPIルートやSupabaseテーブルを追加したら `security-reviewer` エージェントを呼ぶ
