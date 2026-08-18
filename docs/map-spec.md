▼ nicchyo マップ・相談まわり 実装仕様書（app/(public)/map, consult, story, facilities, calendar 一式）

あなたは「nicchyo研究プロジェクト」のフロントエンドエンジニア兼UXデザイナーです。
このプロジェクトの目的は、高知の日曜市をデジタルの力で「未来につなぐ」ことです。

ブランド思想は「不安を減らし、体験が始まる余白をつくる」であり、
「検索（知る）→ 相談（AI）→ 会話（話す）」という段階的な設計で、観光客が現地でのコミュニケーションを楽しめる状態をつくります。

このドキュメントは、当初「相手AIにそのまま渡すプロンプト」として書かれたものですが、
実装が進んだ現在は **現行実装の要約＋今後AIに追加開発を依頼する際の土台** として運用します。
新しく設計を依頼するときは、まず 0〜1 章で現状を正しく共有したうえで、追加・変更したい範囲だけを指示してください。

> **ドキュメントの優先順位**: 実装の現状については本ドキュメントを正典とし、[docs/FEATURES.md](./FEATURES.md)（企画レベルの機能一覧）や `docs/` 配下の他ドキュメントと矛盾する場合は本ドキュメントを優先してください。`docs/` 全体の整理は [#510](https://github.com/KochiDXClub/nicchyo/issues/510)、記述されたパスの実在をCIで検証する仕組みは [#511](https://github.com/KochiDXClub/nicchyo/issues/511) で扱います。

0. 前提情報（必ず理解してから設計してください）
🌿 プロダクトの世界観

nicchyo は、高知の日曜市のマップを基盤に、以下の要素をつなぐ DX プラットフォームです。
ただし、すべての機能を等価には扱わず、体験の入口を支える機能を優先します。

*   🗺 **マップ（Core）**: 不安や緊張を和らげる全体俯瞰図。店舗ピン・丁目区画・ランドマークを重ねたハブページ（`/map`）。
*   🎯 **AI案内役「にちよさん」（Core）**: 独立ページ（`/consult`）から利用する相談機能。マップ側は「このへん」パネルの追い質問とショップバナー単位の相談（`AiConsultPanel`）が同じバックエンドを利用するが、マップ内蔵のチャットUI自体は導線未実装（1章参照）。RAGでナレッジベースを検索し、複数キャラクターの掛け合いで回答する。
*   🛍 **ショップバナー**: 店舗の最小情報（会話のきっかけ）。マップ・検索結果どちらからも同じコンポーネントで開く。
*   📣 **近況（旧ことづて の実質的な後継）**: 出店者が投稿する当日の写真・お知らせを見る機能（`/story`）。ショップバナー内の「今日のお知らせ」とデータソースを共有する。
*   🚻 **おでかけサポート**: お手洗い・休憩ベンチ・公共交通のりばをマップから探せる機能（`/facilities` → `/map` に遷移して案内）。
*   📅 **日曜市カレンダー**: 開催予定・荒天中止・特別開催のお知らせを確認できる機能（`/calendar`）。マップ・近況ページ双方の告知バーとデータを共有する横断的な基盤機能。

※ 従来の独立した「ことづて投稿ページ」（`app/(public)/posts/`）はモックデータのみでバックエンド接続がなく、ナビゲーション上の導線も無い事実上の未使用ページです。ただしルート自体は公開されているため、URL 直打ちでは到達します。新規開発でこのページを起点にしないでください。削除するかどうかは本ドキュメントでなく [#509](https://github.com/KochiDXClub/nicchyo/issues/509) で判断します。
※ 旧仕様にあった「開いてる/完売」の出店状況投票・ステータス表示（`VendorStatus`型・`StatusBadge`）は **実装されていません**。同種の役割は「近況」の匿名ハートリアクションが担っています。
※ レシピ機能（食材店舗ショップバナー内のおすすめレシピ表示、`lib/recipes.ts`、`/recipes` 相当の導線）は削除済みです。今後の設計でも前提にしないでください。

🛠 技術スタック（プロジェクト全体）

*   Next.js 16+ (App Router)
*   React + TypeScript
*   Tailwind CSS
*   Supabase（DB / Auth / RPC によるベクトル検索）
*   Leaflet（マップ描画、`react-leaflet`）
*   OpenAI API（Embeddings + GPT-4o-mini、AI相談のRAGバックエンド。`openai` パッケージは未導入で `fetch` 直叩き）
*   `@anthropic-ai/sdk`（週次セキュリティレポート生成用、マップ・相談機能とは無関係）

1. 各ページが担う機能（現行実装の要約）

*   **`app/(public)/map/`（MapPageClient.tsx がハブ）**
    *   Leaflet地図本体（`MapView.tsx`、SSR無効の `dynamic import`）を中心に、検索バー／ジャンルフィルター、「このへん、なにがある？」パネル、マップ内AI相談パネル、おでかけサポート案内、開催ステータスバー（`MarketStatusBar`）をオーバーレイで重ねる。
    *   レイヤー: `OptimizedShopLayerWithClustering`（店舗ピン、クラスタリング対応）／`ChomeAreaMarkers`・`RoadOverlay`・`BackgroundOverlay`（丁目区画・道路形状・背景）／`FacilityLayer`（おでかけサポート選択時の施設マーカー・ルート）／`UserLocationMarker`（現在地、会場内外判定）。
    *   `ShopDetailBanner.tsx`: 店舗を選択した際に表示される詳細パネル。ヒーロー画像、店名、「今日のお知らせ」（`activePosts` を `PostCarousel` で表示、近況機能とデータ共有）、商品一覧（タップで買い物バッグへ即追加）、SNSリンク、決済方法、「AIに相談する」ボタン（この店舗をコンテキストにした `AiConsultPanel` を起動）を含む。
        *   「今日のお知らせ」は近況機能（`/story`）と同じ `vendor_contents` を参照するが、**取得条件は同一ではない**。マップ側（`app/(public)/map/services/shopDb.ts`）は `status='active'` かつ `expires_at > 現在時刻`（＝有効期限内のみ）、近況側（`app/api/stories/route.ts`）は `status='active'` かつ `image_url IS NOT NULL` かつ `created_at` 直近31日（＝期限切れも含む）。新機能で「お知らせ」を扱う際はどちらの条件に合わせるかを明示すること。
    *   `NearbyExploreButton` / `NearbyExplorePanel`: 「このへん、なにがある？」。画面中心付近の店舗を要約し、お気に入り・買い物バッグの傾向から興味ジャンルを推定して最大9件レコメンドする。
    *   お気に入り（`lib/favoriteShops.ts`）・買い物バッグ（`lib/storage/BagContext.tsx`）はいずれも localStorage 永続化で、サーバー同期はしていない。
        *   ⚠️ **買い物バッグは廃止が決定済み**（[#499](https://github.com/KochiDXClub/nicchyo/issues/499) epic / [#500](https://github.com/KochiDXClub/nicchyo/issues/500)）。以下の記述はいずれも現行実装の説明であり、**バッグ機能の上に新しい設計を積まないでください**。ナビゲーション導線はお気に入り一覧に差し替え予定（[#501](https://github.com/KochiDXClub/nicchyo/issues/501)）、お気に入り自体もサーバー同期化が予定されています（[#502](https://github.com/KochiDXClub/nicchyo/issues/502)）。
    *   AI相談の起点は画面下部 `NavigationBar` の「相談」ボタン（`onConsultClick`）のみ。押すと `/consult` に遷移する。マップ内蔵の `MapCharacterConsult`（地図上に相談UIを重ねる実装）は既にコードとして存在するが、有効化する導線（`mapCharacterConsultActive` を true にする箇所）が現状無く、実質デッドパス。同様に `MapAgentAssistant`（`/api/map-agent` を呼ぶ）も地図上に実装されているが、起動用ランチャーが `hideLauncher` で隠されており到達できない。いずれも将来のマップ内蔵AI相談の下地として残っているコードなので、削除するか有効化するかは [#509](https://github.com/KochiDXClub/nicchyo/issues/509) で判断します。

*   **`app/(public)/consult/`（AI案内役「にちよさん」の独立ページ）**
    *   `ConsultClient.tsx` がロジックのハブ、チャットUIは `GrandmaChatter.tsx` が担う。`GrandmaChatter` はこの `/consult` ページ専用で、マップ側では使われていない（`MapPageClient.tsx` 内の `_GrandmaChatter` はアンダースコア接頭辞の未使用importで、実際には描画されない）。マップ側の相談UIは前項の `MapCharacterConsult` であり、コンポーネントとしては別物。両者は「キャラクター定義（`consultCharacters.ts`）とAPI（`/api/grandma/ask`）を共有するが、UIは別」という関係。
    *   複数AIキャラクター（`consultCharacters.ts`）: にちよさん（土佐弁ベテラン）／よういちさん／みらいくん／よさこちゃん。会話パターンに応じて複数人格が掛け合い形式（`turns`）で返答する。
    *   バックエンドは `app/api/grandma/ask`：質問を OpenAI Embeddings でベクトル化し、Supabase RPC（`match_knowledge_embeddings` / `match_store_knowledge`）で共通ナレッジ・出店者ナレッジを検索するRAG構成。GPT-4o-mini で構造化出力またはストリーミング応答を生成し、おすすめ店舗ID・フォローアップ質問・会話要約を返す。会話ログは `ai_consult_logs` に記録。
    *   マップ側で実際にこのAPIを叩くのは「このへんパネルの追い質問」と「ショップバナーの店舗単位相談（`AiConsultPanel`）」の2箇所（検索バー横には相談導線は無い）。いずれも同じ `/api/grandma/*` を利用する。

*   **`app/(public)/story/`（近況）**
    *   出店者が当日投稿する写真付き近況・お知らせを、Instagramストーリー風UIで見る機能。DBは `vendor_contents`（`status='active'` かつ `image_url IS NOT NULL`、`created_at` 基準で直近31日、最大100件）。
    *   `StoryGridClient.tsx`: 今週の投稿は上部の自動送りプレビューにのみ表示し、グリッド自体からは除外する（一覧APIが `created_at` 降順のため、実質「1週間前」「1か月前」の2段階のグルーピングになる）。
    *   `StoryViewer.tsx`: 全画面ビューア（自動送り・スワイプ操作）。匿名ハートリアクション（`lib/story/reactions.ts`、来訪者キーで1投稿1ハート）が実装されている。
    *   マップのショップバナー内「今日のお知らせ」と同じデータを参照し、店舗番号経由で `/map?shop=<番号>` へ相互リンクする。

*   **`app/(public)/facilities/`（おでかけサポート）**
    *   `/facilities` はカテゴリ選択画面のみ（お手洗い・休憩・公共交通の3種、`lib/facilities/facilities.ts`）。地図描画は持たず、選択すると `/map?facility=<category>` に遷移する。
    *   マップ側の `useFacilityGuide` フックが現在地取得・最寄り施設ランキング（道なり距離）・ルート生成を行い、`FacilityLayer`（マーカー強調）と `FacilityGuidePanel`（一覧）に反映する。
    *   「のりもの」カテゴリのみ静的データを持たず、マップ上のランドマーク（路面電車停留場・JR駅）から動的に生成する。

*   **`app/(public)/calendar/`（日曜市カレンダー）**
    *   サーバーコンポーネント。`lib/market/calendar.ts` の `fetchMarketCalendar()` で開催ステータス・日程一覧を取得。
    *   `MarketStatusBar` は `placement` propで挙動が変わる: マップ埋め込み（`placement="map"`）は開催中止など例外時のみ表示、カレンダー・近況ページ埋め込み（`placement="page"`）は常時表示。`UpcomingSundays`（今後の日曜日一覧）と組み合わせて使う。
    *   `useMarketCalendar` フック経由で map・story 双方の告知バーとデータを共有する横断的な基盤機能。

*   **`app/(public)/search/`（検索）**
    *   カテゴリ・キーワードによる絞り込み・リスト表示。結果はマップへ送って表示することもできる。「確実に知りたい」ニーズへの対応。

2. ディレクトリ構成を新規に検討する場合

独立ページ（`recipes`）は削除済み、`posts`（旧ことづて投稿ページ）は事実上未使用であることを前提にしてください。
`story` / `facilities` / `calendar` / `consult` はいずれも `map` と並ぶ独立ルートとして存在し、マップと相互にリンクしています。新機能を追加する際も、まずこの5ページ＋`search`のどこに属するかを整理してから設計してください。

3. データスキーマ（現行実装の要約）

手書きの型定義はここには置かず、実ファイルを参照してください（型は仕様書より先に実装が変わるため、コピーは必ず腐ります）。

*   近況・ショップバナーの投稿データ: `app/(public)/story/types.ts` の `StoryItem`（`vendor_contents` テーブル＋`location_assignments` 経由の `store_number` を含む）
*   近況の匿名リアクション: `lib/story/reactions.ts` の `ReactionState`（`{ count, reacted }`）。DBは `content_reactions(vendor_content_id, visitor_key)`
*   マップのショップバナーが受け取る「今日のお知らせ」の型: `app/(public)/map/types/shopData.ts` の `activePosts?: { id?, text, imageUrl?, expiresAt, createdAt }[]`（camelCase。上記 `StoryItem` とはデータソース（`vendor_contents`）は共通だが、型としては共有していない点に注意）
*   おでかけサポートのカテゴリ: `lib/facilities/facilities.ts` の `FacilityCategoryId`（`"restroom" | "rest" | "transport"`）

※ 旧仕様書にあった `VendorStatus`（開店中/完売の投票）・`RecipeLink` 型は実装が存在しないため削除しました。出店状況の即時性を担保したい場合は、上記の近況データ構造を拡張するか、`ReactionState` に類する匿名投票を新設する形で設計してください。

4. コンポーネント設計方針

*   **ShopBanner**: マップ・検索結果どちらからも同じコンポーネントで開く。
    *   店名、ジャンル、ヒーロー画像
    *   `PostCarousel`: 「今日のお知らせ」（近況投稿）を表示
    *   商品一覧: タップで買い物バッグへ即追加、Undoトースト付き（バッグは [#500](https://github.com/KochiDXClub/nicchyo/issues/500) で削除予定。商品単位のお気に入りへの置き換えは [#503](https://github.com/KochiDXClub/nicchyo/issues/503)）
    *   `AiConsultPanel` 起動ボタン: この店舗をコンテキストにしたAI相談
*   **GrandmaChatter**: `/consult` 単体ページ専用のチャットUI。複数キャラクターの掛け合い表示に対応。マップ側では使われていない（マップの相談UIは別コンポーネント `MapCharacterConsult`。1章参照）。
*   **AI Consultant 導線**: 「このへん」パネル／ショップバナーの2箇所から、いずれも `/api/grandma/*` を呼び出す（検索バー横には相談導線は無い）。

5. 状態管理の流れ

新規機能を設計する際は、以下の永続化・データソースの分担を踏まえてください。

*   お気に入り・買い物バッグ: localStorage（`lib/favoriteShops.ts`, `lib/storage/BagContext.tsx`）、サーバー同期なし。ただし買い物バッグは [#500](https://github.com/KochiDXClub/nicchyo/issues/500) で削除予定、お気に入りは [#502](https://github.com/KochiDXClub/nicchyo/issues/502) でサーバー同期化予定
*   近況・ショップバナーのお知らせ: Supabase `vendor_contents`（サーバー取得）
*   AI相談の会話ログ: Supabase `ai_consult_logs`（サーバー記録、研究用）
*   開催カレンダー: Supabase 経由（`lib/market/calendar.ts`）、map・story 間で共有
*   AIおすすめ店舗のマップ反映: `lib/searchMapStorage.ts`（localStorage/URLクエリ経由。タブを閉じても消えない永続化）

6. スタイル・アニメーションの方針

*   **全体**: 「安心感」を与えるデザイン。情報の詰め込みすぎを避ける。
*   **モーション**: マップのピンやバナーの出現は、急かさない穏やかなアニメーション。

7. 計測・分析イベント

イベント命名・送信方法は [docs/ANALYTICS_EVENTS.md](./ANALYTICS_EVENTS.md) を正としてください（`shop_impression` / `shop_view` / `shop_scroll` などは `sendEvent()` 経由で送信。ただし `page_view` のみ `PageVisitTracker.tsx` が `gtag()` を直接呼んでおり `sendEvent()` を経由しない）。本ドキュメントに個別のイベント名を重複定義しません。

以上を踏まえて、追加・変更したい範囲を具体的に指示してください。ディレクトリ構成案から順に出力させ、その後具体的なコードを提示させる進め方を推奨します。
