# Copilot instructions for nicchyo-platform

目的: このリポジトリでの Copilot セッションが素早く有益な提案を行えるよう、ビルド/テスト/構造や慣習など“このリポジトリ固有”の情報をまとめる。

---

## 実行コマンド（ビルド / テスト / リント）
- 開発サーバ: npm run dev
- 本番ビルド: npm run build
- 起動（ビルド後）: npm run start
- リント: npm run lint
- テスト（プロジェクト既定）: npm run test  -> 実体は `vitest run --passWithNoTests`
- Prisma: npm run prisma:generate / npm run prisma:migrate

単一テストの実行方法（既存のテストがある場合）:
- ファイル指定で実行: npx vitest run path/to/file.test.ts
- 名前で絞る: npx vitest -t "部分的なテスト名"

---

## ハイレベルアーキテクチャ
- Next.js 16 (App Router) をフロントエンドに採用。ルート構造は app/ 以下（公開ルートは app/(public)/ 以下）。
- 地図 UI: Leaflet を用いた軽量マップ（components/map, app/(public)/map が中心）。
- AI 案内役: RAG を想定したチャット機能（lib/ に RAG/検索用ユーティリティがある想定）。OpenAI 等の API キーを env 経由で与える。
- バックエンド/DB: Supabase（環境変数 NEXT_PUBLIC_SUPABASE_* を参照）。
- 共通ロジック: lib/、UI コンポーネントは components/ または app 内の components 配下に配置。
- 静的アセット: public/ に画像・地図素材を配置。

---

## このリポジトリ特有の重要な慣習（Key conventions）
- ルートとファイル命名:
  - ルート（URL）: kebab-case
  - React コンポーネント: PascalCase
  - 変数/関数: camelCase
- Next.js の App Router/Layouts を利用するため、クライアントコンポーネントが必要なファイルは冒頭に "use client" を置く。
- UI は Tailwind CSS。カスタムパレットは tailwind.config.js にある。
- public/ に画像を置き、コード中は静的パス参照を優先する（大きなバイナリは避ける）。
- PR 前: npm run build を実行して型/ルート問題を捕まえる（.next/ をコミットしない）。
- テストは現状ほぼ未実装だが、vite/ vitest が用意されている。テスト追加時は vitest 慣例に従う（*.test.ts[x]）。
- Prisma 関連コマンドは package.json に定義済み（generate / migrate）。

---

## 既存のドキュメント / AI 設定への参照
- README.md と docs/ 内にプロダクト方針・機能仕様がある（CONCEPT.md, FEATURES.md など）。Copilot はこれらを参照して提案すること。
- このリポジトリには AGENTS.md がある。エージェント方針や補助ファイルはそちらにまとめられているため、Copilot セッションで参照してほしい。
- リポジトリルートに vitest.config.ts と tsconfig があるため、型・テスト設定はそこを参照する。

---

## LSP / 開発支援ツール（ヒント）
- LSP を使う場合はユーザー設定 (~/.copilot/lsp-config.json) かリポジトリレベルの .github/lsp.json を参照する（存在する場合）。
- Node エンジン: package.json の engines に node 24.x と指定あり。CI/環境合わせに注意。

---

作成・更新履歴:
- ファイル作成: .github/copilot-instructions.md


---

短い要約: このファイルはリポジトリ固有のコマンド、構造、慣習をまとめたものです。必要なら範囲を拡張して、たとえばテストパターン（例: E2E / Playwright）やよくあるコード改修ワークフローを追記できます。
