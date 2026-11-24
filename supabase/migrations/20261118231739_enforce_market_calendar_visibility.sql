-- 日付・イベントの公開列を直接読む場合も、公開中の市の行だけを返す。
-- 既存の列権限は維持し、market_id や登録者を一般に公開しない。
alter policy "market_days_select_public" on public.market_days
  using (market_id in (select id from public.markets where is_public));

alter policy "market_events_select_public" on public.market_events
  using (is_published and market_id in (select id from public.markets where is_public));

-- 管理者は公開前の開催状況を確認できる。市マスタ・開催状況の書き込みと同じロールを使う。
create policy "market_days_select_admin" on public.market_days
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

alter policy "market_events_select_admin" on public.market_events to authenticated;
