# アクセス解析イベント仕様

実装の正は `lib/analytics/`・`types/analytics.ts`・`app/api/analytics/`。この文書は全体像と守る約束だけを書く（イベントの個別パラメータは型定義を見る）。

## 約束

- イベント名・パラメータキーは snake_case
- クライアントからのイベント送信は `sendEvent(name, params, options)`（`lib/analytics/sendEvent.ts`）を通す。イベント名の一覧は `types/analytics.ts` の `AnalyticsEventName`
- **オプトアウト方式**。同意バナーは無く、既定では解析は動く。止めた端末（プライバシーポリシーのスイッチ。`localStorage` の `nicchyo_analytics_opt_out`）では `isAnalyticsOptedOut()`（`lib/analytics/consentClient.ts`）が真になり、何も送らない。新しい送信箇所でも必ずこの判定を通すこと
- PII 禁止。メール・電話・生のユーザー ID は送らない
- サーバー側の書き込みは service role のみ（クライアントからの直接 INSERT は RLS で禁止）。各 API は `requireSameOrigin` と `enforceRateLimit` を通す

## 送信経路

| 経路 | 使うもの | 送り先 |
|---|---|---|
| GA4 / GTM | `sendEvent`（`dataLayer.push` と `gtag("event")`） | GA。本番のみ `loadGA()` で遅延読み込み |
| サーバー記録 | `sendEvent(..., { toServer: true })` | 下表の API |
| ページ訪問 | `app/components/PageVisitTracker.tsx` | `POST /api/analytics/page-visit`、遷移ごとの GA4 `page_view`（`gtag()` を直接呼ぶ。`sendEvent` は経由しない） |
| 店舗詳細の閲覧数 | `recordShopView()`（`lib/analytics/shopViews.ts`） | `POST /api/analytics/shop-view` |
| マイページ訪問 | `app/(public)/my-shop/layout.tsx` | `POST /api/analytics/home-visit` |

`/api/analytics/home-summary` は出店者ホームの集計取得用（書き込みではない）。

## 現在送っているイベント

| イベント | 発火元 | サーバー記録 |
|---|---|---|
| `page_view` | `PageVisitTracker.tsx` が `gtag()` を直接呼ぶ | `page-visit`（`web_page_analytics`） |
| `guide_open` / `guide_navigation_start` / `guide_arrived` / `guide_navigation_stop` | `app/(public)/map/hooks/useOdekakeGuide.ts`（おでかけサポート） | `POST /api/analytics/guide-event` → `guide_events` |

店舗詳細が開かれた回数は `sendEvent` ではなく `recordShopView()`（`ShopDetailBanner.tsx` から呼ぶ）で記録する。流入元は `map` / `search` / `direct`、同じタブで同じ店を開き直しても 1 回だけ数え、出店者本人の閲覧は数えない。

## 定義はあるが、現在は呼び出し元が無いもの

`sendEvent` は次を処理できるが、アプリ内に発火している箇所は無い（再び使うときは呼び出しを足す）。

- `shop_impression` / `shop_view`（型のみ。サーバー記録の API `shop-interaction` は呼び出し元が無く、入力無検証の公開書き込み口だったため削除した。再び使うときは `guide-event` と同じ方式で API を作り直す）
- `shop_scroll`（`trackScrollDepth()` が 25/50/75/100% で発火）。呼び出し元なし
- `add_to_bag`（型のみ。買い物リスト機能は廃止済み）

`shop_interactions` の `ip_address` は 8 日で NULL 化される（`supabase/migrations/20260817205614_add_personal_data_retention.sql`）。

## 検証

- GA DebugView でイベントを確認する
- サーバー記録は Supabase の該当テーブル（`guide_events` など）に行が入ることを見る
- オプトアウトの E2E は `tests/e2e/analytics.spec.ts`
