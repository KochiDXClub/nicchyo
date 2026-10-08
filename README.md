# nicchyo | Kochi Sunday Market Digital Platform

nicchyo（ニッチョ） は、高知・日曜市を訪れる初来訪者の「不安」を「安心」に変え、体験が始まる入口をつくるためのデジタルマッププロジェクトです。

従来の観光マップのような「効率化・最適化」ではなく、**「検索（知る）→ 相談（AI）→ 会話（話す）」** という段階的な設計により、来場者がデジタルの画面に釘付けにならず、現地でのコミュニケーションや偶然の出会いを楽しめる状態をつくります。

---

## コンセプト
**「不安を減らし、体験が始まる余白をつくる」**
日曜市の魅力である「迷い」や「人との距離感」を損なわないよう、あえて情報を網羅せず、現地で出店者に聞くきっかけを残す「引き算の設計」を採用しています。

詳細は [docs/CONCEPT.md](docs/CONCEPT.md) をご覧ください。

## 提供中の機能（Core Features）
nicchyoは、以下の「主機能」と体験を補助する「副機能」で構成されています。

### 主機能
*   **Webデジタルマップ**: インストール不要。現在地と全体の雰囲気を直感的に把握できる軽量マップ（Leaflet、MapLibre GL への移行を並走検証中）。
*   **AI案内役「にちよさん」**: RAG技術を用いたAIチャットボット。検索では拾いきれない曖昧な悩みや「おすすめ」を相談でき、現地での会話へ橋渡しします。
*   **検索機能**: 「確実に知りたい」ニーズに対応するカテゴリ・キーワード検索。
*   **ショップバナー**: 店舗の最小情報を表示。詳細を書きすぎず、店主に話しかけるきっかけを作ります。

### 補助機能
*   **お気に入り**: 気になる店舗を保存して見返せる機能（`/favorites`、現状は端末内保存）。買い物バッグ機能は廃止しました。
*   **近況**: 出店者が投稿する今週の写真・お知らせを一覧で見られる機能（`/story`）。来場者からの投稿は行わず、出店者・運営者からの片方向発信のみで構成しています。
*   **日曜市カレンダー**: 開催予定・荒天中止・特別開催などのお知らせをまとめて確認できる機能（`/calendar`）。
*   **おでかけサポート**: お手洗い・休憩用ベンチ・最寄りの公共交通のりばをマップ上で探し、そこまで案内する機能（`/map?guide=menu`）。

詳細は [docs/FEATURES.md](docs/FEATURES.md) をご覧ください。

### 開発スコープ外（Not Implemented）
*   リアルタイム投稿機能（SNS的機能の排除）
*   ゲーミフィケーション・イベント機能
*   ルート最適化機能

## 主要技術 (Tech Stack)
本プロジェクトは、学生主体での継続的な運用・改善（部活動化）を前提に、モダンかつメンテナンス性の高い技術を選定しています。

*   **Frontend**: Next.js 16 (App Router), React 18, TypeScript 5.9
*   **Styling**: Tailwind CSS
*   **Backend / DB**: Supabase
*   **Map Library**: Leaflet + react-leaflet（`reactStrictMode: false` は意図的）。MapLibre GL は並走検証中
*   **AI / Search**: OpenAI API (RAG構成。使用モデルは管理画面から切替可能、`lib/ai/models.ts`)
*   **Rate limit**: Upstash Redis
*   **Test**: Vitest + React Testing Library

## ディレクトリ構成 (Key Structure)
※開発の進捗により、独立ページは統合・整理されています。

*   `app/(public)/map`: マップ UI（メイン機能。地図コンポーネント一式は `map/components/` 配下）
*   `app/(public)/search`: 店舗検索
*   `app/(public)/favorites`: お気に入り
*   `app/(public)/consult`: AI相談「にちよさん」
*   `app/(public)/story`: 近況（出店者からの一方向発信）
*   `app/(public)/calendar`: 日曜市カレンダー
*   `app/(public)/facilities`: おでかけサポート（旧ページ。`/map?guide=menu` へ転送するだけ）
*   `app/(public)/my-shop`, `app/vendor`: 出店者向けページ
*   `app/(public)/admin`: 管理者向けページ
*   `app/analysis`: 日曜市をデータで見る（分析ページ）
*   `app/api/grandma`: AI「にちよさん」バックエンド
*   `components/ui`: 共通UI部品（[デザインシステム](docs/DESIGN_SYSTEM.md)）
*   `lib/`: 共通データ・ユーティリティ
*   `supabase/migrations`: DBマイグレーション
*   `public/`: 画像・静的アセット

## セットアップ

### 1. 依存関係
```bash
npm install
```

### 2. 環境変数 (.env.local など)
SupabaseおよびAI機能等のキーを設定してください。

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
# 互換用: NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
```

**本番デプロイ時は `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` も必須**です。
Vercel は複数インスタンスで動くため、これが無いとレート制限がインスタンスごとの
in-memory フォールバックになり実効性を失います（未設定のまま本番稼働すると
`/api/health` が 503 を返します）。ローカル開発では不要です。
その他の任意環境変数は `.env.example` を参照してください。

### 3. 開発サーバ
```bash
npm run dev
```

### 4. ビルド・テスト
```bash
npm run build   # 本番ビルド（型チェックを含む）
npm run lint    # ESLint
npm test        # Vitest
```

PR を出す前の確認（`npm run code-health:diff` など）は [docs/CODE_HEALTH.md](docs/CODE_HEALTH.md)、
ローカル環境の詳しい手順は [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) を参照してください。

## ドキュメント一覧 (Docs Index)

| 知りたいこと | 参照先 |
|---|---|
| ロール別（来訪者・出店者・管理者）の機能要件と重要度 | [docs/requirements/](docs/requirements/README.md) |
| なぜ作るか・何を作らないか（企画） | [docs/CONCEPT.md](docs/CONCEPT.md) / [docs/FEATURES.md](docs/FEATURES.md) |
| マップ・相談まわりの実装仕様 | [docs/map-spec.md](docs/map-spec.md) |
| UI を書くときのトークン・共通部品 | [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) |
| リリース運用・DBマイグレーション | [docs/RELEASE.md](docs/RELEASE.md) |
| コードの健康診断（共通化・重複の計測） | [docs/CODE_HEALTH.md](docs/CODE_HEALTH.md) |
| スプレッドシートでの文言編集 | [docs/SITE_COPY.md](docs/SITE_COPY.md) |
| 開発の進め方・AI エージェント向けガイドライン | [CONTRIBUTING.md](CONTRIBUTING.md) / [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) |

## 運営・ライセンス
*   **主体**: 高知高専 nicchyo プロジェクト（re-KOSEN 採択事業 / 2025年度より部活動化予定）
*   **協力要請先**: 高知市商業振興課街路市担当、日曜市出店者の皆様

詳細なプロジェクト情報は [docs/PROJECT_INFO.md](docs/PROJECT_INFO.md) をご覧ください。
