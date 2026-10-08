-- market_events の公開列を絞る。
--
-- 作成時は `GRANT SELECT ON public.market_events TO anon` とテーブル全体を公開していたが、
-- created_by（管理者の auth.users UUID）は公開する必然性がない。RLS で公開行に絞られても、
-- 公開イベントが1件あれば PostgREST 経由で作成者の UUID を読み出せてしまう。
--
-- market_days（20260807105105）で同じ判断をしているので、こちらも揃える。
-- 参照側（lib/market/calendar.ts）は列を明示指定しているため select=* には依存しない。

REVOKE SELECT ON public.market_events FROM anon, authenticated;

GRANT SELECT (
  id, title, description, event_date, end_date, start_time, end_time,
  location, is_published, category, image_url, is_highlight, created_at, updated_at
) ON public.market_events TO anon;

GRANT SELECT (
  id, title, description, event_date, end_date, start_time, end_time,
  location, is_published, category, image_url, is_highlight, created_at, updated_at
) ON public.market_events TO authenticated;

-- 目的：日曜市カレンダー（docs/discussion-market-calendar.md）。
-- market_days と同じ基準で、管理者UUIDを公開経路から外す。
