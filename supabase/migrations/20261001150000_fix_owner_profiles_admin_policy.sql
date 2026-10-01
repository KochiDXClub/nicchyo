-- vendor_owner_profiles の管理者ポリシーを、vendors.role ではなく app_metadata.role で判定する
--
-- 不具合:
--   20260807112200 の "admins read all owner profiles" は
--     exists (select 1 from public.vendors where vendors.id = auth.uid() and vendors.role = 'admin')
--   で管理者を判定している。ところが 20260807120000 で authenticated の vendors への SELECT を
--   列単位に絞ったとき、role は許可に含めなかった。
--   ポリシーの式は問い合わせたユーザーの権限で評価されるため、ログイン中のユーザーが
--   vendor_owner_profiles を読むたびに「vendors.role を読む権限が無い」で失敗し、
--   PostgREST が 403 を返していた（本人の行を読むポリシーと OR で結合されても、権限の検査は
--   式全体に対して先に行われるので避けられない）。
--
--   影響:
--   - 店舗情報の編集（/vendor/store）と にちよさんの質問（/my-shop/ask）が開けない
--     （店主名を読めないと画面ごと「読めんかった」にしている）
--   - ログイン中にマップを開くと、公開設定の店主名が出ない
--
-- 対応:
--   運営判定はすでに public.current_user_role()（auth.jwt() の app_metadata.role）に
--   寄せている（20260904090000, #528）。管理者アカウントには vendors 行が無く、
--   vendors.role は実質 'vendor' 固定なので、元のポリシーは管理者にも効いていなかった。
--   管理画面の店主名の取得は service_role で行っているため、この差し替えで管理画面は変わらない。

drop policy if exists "admins read all owner profiles" on public.vendor_owner_profiles;
create policy "admins read all owner profiles"
  on public.vendor_owner_profiles
  for select
  to authenticated
  -- (select ...) で包んで、行ごとではなく1回だけ評価させる
  using ((select public.current_user_role()) = 'admin');
