-- 閲覧ログは検証・レート制限・サーバー側ロール判定を通るAPIからだけ記録する。
drop policy if exists "public insert page analytics" on public.web_page_analytics;
revoke insert on public.web_page_analytics from anon, authenticated;
