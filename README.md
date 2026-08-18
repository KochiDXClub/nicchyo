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
*   **Webデジタルマップ**: インストール不要。現在地と全体の雰囲気を直感的に把握できる軽量マップ（Leaflet採用）。
*   **AI案内役「にちよさん」**: RAG技術を用いたAIチャットボット。検索では拾いきれない曖昧な悩みや「おすすめ」を相談でき、現地での会話へ橋渡しします。
*   **検索機能**: 「確実に知りたい」ニーズに対応するカテゴリ・キーワード検索。
*   **ショップバナー**: 店舗の最小情報を表示。詳細を書きすぎず、店主に話しかけるきっかけを作ります。

### 補助機能
*   **バッグ機能（買い物リスト）**: 気になる商品をメモし、記憶の負担を減らして目の前の体験に集中させる機能。
*   **近況**: 出店者が投稿する今週の写真・お知らせを一覧で見られる機能（`/story`）。来場者からの投稿は行わず、出店者・運営者からの片方向発信のみで構成しています。
*   **日曜市カレンダー**: 開催予定・荒天中止・特別開催などのお知らせをまとめて確認できる機能（`/calendar`）。
*   **おでかけサポート**: お手洗い・休憩用ベンチ・最寄りの公共交通のりばをマップから探せる機能（`/facilities`）。

詳細は [docs/FEATURES.md](docs/FEATURES.md) をご覧ください。

### 開発スコープ外（Not Implemented）
*   リアルタイム投稿機能（SNS的機能の排除）
*   ゲーミフィケーション・イベント機能
*   ルート最適化機能

## 主要技術 (Tech Stack)
本プロジェクトは、学生主体での継続的な運用・改善（部活動化）を前提に、モダンかつメンテナンス性の高い技術を選定しています。

*   **Frontend**: Next.js 16 (App Router), React, TypeScript
*   **Styling**: Tailwind CSS
*   **Backend / DB**: Supabase
*   **Map Library**: Leaflet (軽量でカスタマイズ性を重視)
*   **AI / Search**: OpenAI API (RAG構成)

## ディレクトリ構成 (Key Structure)
※開発の進捗により、独立ページは統合・整理されています。

*   `app/(public)/map`: マップ UI（メイン機能。地図コンポーネント一式は `map/components/` 配下）
*   `app/(public)/search`: 店舗検索
*   `app/(public)/bag`: バッグ（買い物リスト）
*   `app/(public)/story`: 近況（出店者からの一方向発信）
*   `app/(public)/calendar`: 日曜市カレンダー
*   `app/(public)/facilities`: おでかけサポート
*   `app/(public)/my-shop`: 出店者向けページ
*   `app/(public)/admin`: 管理者向けページ
*   `app/api/grandma`, `app/api/map-agent`: AI「にちよさん」バックエンド
*   `lib/`: 共通データ・ユーティリティ
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
# NEXT_PUBLIC_MAPBOX_TOKEN= (※Leafletのタイル設定による)
```

### 3. 開発サーバ
```bash
npm run dev
```

### 4. ビルド
```bash
npm run build
```

## 運営・ライセンス
*   **主体**: 高知高専 nicchyo プロジェクト（re-KOSEN 採択事業 / 2025年度より部活動化予定）
*   **協力要請先**: 高知市商業振興課街路市担当、日曜市出店者の皆様

詳細なプロジェクト情報は [docs/PROJECT_INFO.md](docs/PROJECT_INFO.md) をご覧ください。
