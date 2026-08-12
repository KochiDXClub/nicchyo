▼ nicchyo マップ・相談まわり 実装仕様書（app/(public)/map, consult, story, facilities, calendar 一式）

あなたは「nicchyo研究プロジェクト」のフロントエンドエンジニア兼UXデザイナーです。
このプロジェクトの目的は、高知の日曜市をデジタルの力で「未来につなぐ」ことです。

ブランド思想は「不安を減らし、体験が始まる余白をつくる」であり、
「検索（知る）→ 相談（AI）→ 会話（話す）」という段階的な設計で、観光客が現地でのコミュニケーションを楽しめる状態をつくります。

このドキュメントは、当初「相手AIにそのまま渡すプロンプト」として書かれたものですが、
実装が進んだ現在は **現行実装の要約＋今後AIに追加開発を依頼する際の土台** として運用します。
新しく設計を依頼するときは、まず 0〜1 章で現状を正しく共有したうえで、追加・変更したい範囲だけを指示してください。

0. 前提情報（必ず理解してから設計してください）
🌿 プロダクトの世界観

nicchyo は、高知の日曜市のマップを基盤に、以下の要素をつなぐ DX プラットフォームです。
ただし、すべての機能を等価には扱わず、体験の入口を支える機能を優先します。

*   🗺 **マップ（Core）**: 不安や緊張を和らげる全体俯瞰図。店舗ピン・丁目区画・ランドマークを重ねたハブページ（`/map`）。
*   🎯 **AI案内役「にちよさん」（Core）**: マップ埋め込みと独立ページ（`/consult`）の両方から利用できる相談機能。RAGでナレッジベースを検索し、複数キャラクターの掛け合いで回答する。
*   🛍 **ショップバナー**: 店舗の最小情報（会話のきっかけ）。マップ・検索結果どちらからも同じコンポーネントで開く。
*   📣 **近況（旧ことづて の実質的な後継）**: 出店者が投稿する当日の写真・お知らせを見る機能（`/story`）。ショップバナー内の「今日のお知らせ」とデータソースを共有する。
*   🚻 **おでかけサポート**: お手洗い・休憩ベンチ・公共交通のりばをマップから探せる機能（`/facilities` → `/map` に遷移して案内）。
*   📅 **日曜市カレンダー**: 開催予定・荒天中止・特別開催のお知らせを確認できる機能（`/calendar`）。マップ・近況ページ双方の告知バーとデータを共有する横断的な基盤機能。

※ 従来の独立した「ことづて投稿ページ」（`app/(public)/posts/`）はモックデータのみでバックエンド接続がなく、ナビゲーション上の導線も無い事実上の未使用ページです。新規開発でこのページを起点にしないでください（削除候補）。
※ 旧仕様にあった「開いてる/完売」の出店状況投票・ステータス表示（`VendorStatus`型・`StatusBadge`）は **実装されていません**。同種の役割は「近況」の匿名ハートリアクションが担っています。
※ レシピ機能（食材店舗ショップバナー内のおすすめレシピ表示、`lib/recipes.ts`、`/recipes` 相当の導線）は削除されました。今後の設計でも前提にしないでください。

🛠 技術スタック（プロジェクト全体）

*   Next.js 16+ (App Router)
*   React + TypeScript
*   Tailwind CSS
*   Supabase（DB / Auth / RPC によるベクトル検索）
*   Leaflet（マップ描画、`react-leaflet`）
*   OpenAI API（Embeddings + GPT-4o-mini、AI相談のRAGバックエンド）

1. 各ページが担う機能（現行実装の要約）

*   **`app/(public)/map/`（MapPageClient.tsx がハブ）**
    *   Leaflet地図本体（`MapView.tsx`、SSR無効の `dynamic import`）を中心に、検索バー／ジャンルフィルター、「このへん、なにがある？」パネル、AI相談パネル、おでかけサポート案内、開催ステータスバー（`MarketStatusBar`）をオーバーレイで重ねる。
    *   レイヤー: `OptimizedShopLayerWithClustering`（店舗ピン、クラスタリング対応）／`ChomeAreaMarkers`・`RoadOverlay`・`BackgroundOverlay`（丁目区画・道路形状・背景）／`FacilityLayer`（おでかけサポート選択時の施設マーカー・ルート）／`UserLocationMarker`（現在地、会場内外判定）。
    *   `ShopDetailBanner.tsx`: 店舗を選択した際に表示される詳細パネル。ヒーロー画像、店名、「今日のお知らせ」（`activePosts` を `PostCarousel` で表示、近況機能とデータ共有）、商品一覧（タップで買い物バッグへ即追加）、SNSリンク、決済方法、「AIに相談する」ボタン（この店舗をコンテキストにした `AiConsultPanel` を起動）を含む。
    *   `NearbyExploreButton` / `NearbyExplorePanel`: 「このへん、なにがある？」。画面中心付近の店舗を要約し、お気に入り・買い物バッグの傾向から興味ジャンルを推定して数件レコメンドする。
    *   お気に入り（`lib/favoriteShops.ts`）・買い物バッグ（`lib/storage/BagContext.tsx`）はいずれも localStorage 永続化で、サーバー同期はしていない。

*   **`app/(public)/consult/`（AI案内役「にちよさん」の独立ページ）**
    *   `ConsultClient.tsx` がロジックのハブ、チャットUIはマップ側と共用の `GrandmaChatter.tsx` が担う。
    *   複数AIキャラクター（`consultCharacters.ts`）: にちよさん（土佐弁ベテラン）／よういちさん／みらいくん／よさこちゃん。会話パターンに応じて複数人格が掛け合い形式（`turns`）で返答する。
    *   バックエンドは `app/api/grandma/ask`：質問を OpenAI Embeddings でベクトル化し、Supabase RPC（`match_knowledge_embeddings` / `match_store_knowledge`）で共通ナレッジ・出店者ナレッジを検索するRAG構成。GPT-4o-mini で構造化出力またはストリーミング応答を生成し、おすすめ店舗ID・フォローアップ質問・会話要約を返す。会話ログは `ai_consult_logs` に記録。
    *   マップ側からは「検索バー横のAI相談導線」「このへんパネルの追い質問」「ショップバナーの店舗単位相談」がいずれも同じ `/api/grandma/*` を利用する。

*   **`app/(public)/story/`（近況）**
    *   出店者が当日投稿する写真付き近況・お知らせを、Instagramストーリー風UIで見る機能。DBは `vendor_contents`（直近31日、`status='active'`）。
    *   `StoryGridClient.tsx`: 投稿の新しさで3段階に分類したグリッド一覧。今週分は上部の自動送りプレビューでも表示。
    *   `StoryViewer.tsx`: 全画面ビューア（自動送り・スワイプ操作）。匿名ハートリアクション（`lib/story/reactions.ts`、来訪者キーで1投稿1ハート）が実装されている。
    *   マップのショップバナー内「今日のお知らせ」と同じデータを参照し、店舗番号経由で `/map?shop=<番号>` へ相互リンクする。

*   **`app/(public)/facilities/`（おでかけサポート）**
    *   `/facilities` はカテゴリ選択画面のみ（お手洗い・休憩・公共交通の3種、`lib/facilities/facilities.ts`）。地図描画は持たず、選択すると `/map?facility=<category>` に遷移する。
    *   マップ側の `useFacilityGuide` フックが現在地取得・最寄り施設ランキング（道なり距離）・ルート生成を行い、`FacilityLayer`（マーカー強調）と `FacilityGuidePanel`（一覧）に反映する。
    *   「のりもの」カテゴリのみ静的データを持たず、マップ上のランドマーク（路面電車停留場・JR駅）から動的に生成する。

*   **`app/(public)/calendar/`（日曜市カレンダー）**
    *   サーバーコンポーネント。`lib/market/calendar.ts` の `fetchMarketCalendar()` で開催ステータス・日程一覧を取得。
    *   `MarketStatusBar`（開催中止など例外時のみ表示）と `UpcomingSundays`（今後の日曜日一覧）で構成。
    *   `useMarketCalendar` フック経由で map・story 双方の告知バーとデータを共有する横断的な基盤機能。

*   **`app/(public)/search/`（検索）**
    *   カテゴリ・キーワードによる絞り込み・リスト表示。結果はマップへ送って表示することもできる。「確実に知りたい」ニーズへの対応。

2. ディレクトリ構成を新規に検討する場合

独立ページ（`recipes`）は廃止済み、`posts`（旧ことづて投稿ページ）は事実上未使用であることを前提にしてください。
`story` / `facilities` / `calendar` / `consult` はいずれも `map` と並ぶ独立ルートとして存在し、マップと相互にリンクしています。新機能を追加する際も、まずこの5ページ＋`search`のどこに属するかを整理してから設計してください。

3. データスキーマ（現行実装の要約）

```typescript
// ショップバナー内「今日のお知らせ」（近況と共有）
interface VendorContent {
  id: string;
  body: string;
  image_url?: string;
  expires_at: string;
  created_at: string;
  vendor: {
    id: string;
    shop_name: string;
    shop_image_url?: string;
    store_number?: number; // location_assignments 経由でマップの店舗番号に解決
  };
}

// 近況ページの匿名リアクション
interface StoryReaction {
  storyId: string;
  visitorKey: string; // 端末単位の匿名キー、1投稿1ハート
}

// おでかけサポートのカテゴリ
type FacilityCategoryId = "restroom" | "rest" | "transport";
```

※ 旧仕様書にあった `VendorStatus`（開店中/完売の投票）・`RecipeLink` 型は実装が存在しないため削除しました。出店状況の即時性を担保したい場合は、上記 `VendorContent` の仕組みを拡張するか、`StoryReaction` に類する匿名投票を新設する形で設計してください。

4. コンポーネント設計方針

*   **ShopBanner**: マップ・検索結果どちらからも同じコンポーネントで開く。
    *   店名、ジャンル、ヒーロー画像
    *   `PostCarousel`: 「今日のお知らせ」（近況投稿）を表示
    *   商品一覧: タップで買い物バッグへ即追加、Undoトースト付き
    *   `AiConsultPanel` 起動ボタン: この店舗をコンテキストにしたAI相談
*   **GrandmaChatter**: マップ埋め込み・`/consult` 単体ページの両方で共用するチャットUI。複数キャラクターの掛け合い表示に対応。
*   **AI Consultant 導線**: 検索バー横／「このへん」パネル／ショップバナーの3箇所から、いずれも `/api/grandma/*` を呼び出す。

5. 状態管理の流れ

新規機能を設計する際は、以下の永続化・データソースの分担を踏まえてください。

*   お気に入り・買い物バッグ: localStorage（`lib/favoriteShops.ts`, `lib/storage/BagContext.tsx`）、サーバー同期なし
*   近況・ショップバナーのお知らせ: Supabase `vendor_contents`（サーバー取得）
*   AI相談の会話ログ: Supabase `ai_consult_logs`（サーバー記録、研究用）
*   開催カレンダー: Supabase 経由（`lib/market/calendar.ts`）、map・story 間で共有
*   AIおすすめ店舗のマップ反映: `lib/searchMapStorage.ts`（sessionStorage/URLクエリ経由）

6. スタイル・アニメーションの方針

*   **全体**: 「安心感」を与えるデザイン。情報の詰め込みすぎを避ける。
*   **モーション**: マップのピンやバナーの出現は、急かさない穏やかなアニメーション。

7. 計測・分析イベント

イベント命名・送信方法は [docs/ANALYTICS_EVENTS.md](./ANALYTICS_EVENTS.md) を正としてください（`page_view` / `shop_impression` / `shop_view` / `shop_scroll` など、`sendEvent()` 経由で送信）。本ドキュメントに個別のイベント名を重複定義しません。

以上を踏まえて、追加・変更したい範囲を具体的に指示してください。ディレクトリ構成案から順に出力させ、その後具体的なコードを提示させる進め方を推奨します。
