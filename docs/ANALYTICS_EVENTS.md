# Analytics events spec (nicchyo-platform)

目的
- 店舗接触／スクロール操作を含む主要ユーザー行動を一貫した形で収集し、クライアント（GA/GTM）とサーバ（Supabase）双方で信頼性の高いログを保つ。

命名規約
- イベント名: snake_case（例: shop_view, shop_impression）
- パラメータキー: snake_case
- 送信方法: sendEvent(name, params) を通すこと（lib/analytics/sendEvent.ts）
- 同意: ユーザーが同意していない場合は送信しない（consentClient を使用）

共通パラメータ
- visitor_key?: string（クライアントが保持する匿名キー、送る場合は明示）
- shop_id?: string
- page_path, page_location

必須イベント（優先）

1. page_view
- 説明: ページ読み込み／SPA遷移時に発火
- パラメータ: page_path (string), page_location (string), page_title? (string)
- 送信先: gtag (GA)、dataLayer

2. shop_impression
- 説明: 一覧やマップでショップが視認可能になった時
- パラメータ:
  - shop_id (string)
  - shop_name? (string)
  - list_position? (number)
  - context (string) — 'map_cluster'|'list'|'search_result'|'banner'
- 送信先: sendEvent → dataLayer/gtag + POST /api/analytics/shop-interaction (event_type: 'impression')

3. shop_view
- 説明: ショップ詳細／バナーを開いたとき
- パラメータ:
  - shop_id (string)
  - source (string) — 'banner'|'map'|'search'
  - interaction_method (string) — 'tap'|'click'
- 送信: dataLayer/gtag + server-side shop_interaction (event_type: 'view')

4. shop_scroll
- 説明: ショップ詳細ページでのスクロール深度
- パラメータ:
  - shop_id (string)
  - scroll_area (string) — 'shop_detail'|'shop_list'|'map'
  - scroll_depth (number) 0..100
  - viewport_time (number) 秒
- 実装: クライアントで閾値(25/50/75/100)を監視しイベント化。sendEvent を通して server にも必要時送る。

運用と検証
- DebugView: GA DebugView にて realtime イベントを確認
- サーバ: supabase の shop_interactions テーブルに行が入ること
- E2E: Playwright で「同意→表示→クリック」を自動検証

実装注意点
- 同意がない場合はどのイベントも送らない
- PII 禁止: メール・電話・生ID は送らない
- サーバ挿入は service role を使う（RLS で public INSERT を禁止）

付録
- 実装済み API: /api/analytics/shop-interaction
- DB: supabase/migrations に shop_interactions が追加済

次の作業
- lib/analytics/sendEvent.ts を実装（wrapper） → UI へ差し込み → E2E
