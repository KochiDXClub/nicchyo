-- location_assignments（店舗と区画・開催日の割り当て）を、出店者からは読み取り専用にする。
--
-- 背景:
--   20261003100100 の "vendors manage own assignments" は for all（SELECT / INSERT / UPDATE / DELETE）で、
--   store_edit 権限を持つ店舗メンバーなら、自店の行を PostgREST 経由で直接書き換えられた。
--   区画の割り当ては運営だけが決めるデータで、アプリにも出店者が書き込む経路は無い（grep 済み）。
--   運営の書き込みはすべて service_role（app/api/admin/**）か SECURITY DEFINER の関数
--   （save_map_layout / restore_map_layout_snapshot / admin_place_shop）経由なので、この変更の影響を受けない。
--
-- 読み取りは変えない:
--   公開の "public read listed assignments"（20261004120000）が、vendors で読める店舗の行を許している。
--   店舗メンバーは vendors の "members read own vendor" で自店を読めるので、これまでどおり自店の行も読める。
--   念のため、メンバー向けの SELECT ポリシーも同じ条件で残す。
--
-- 冪等: drop policy if exists → create policy / revoke。

drop policy if exists "vendors manage own assignments" on public.location_assignments;
drop policy if exists "vendors read own assignments" on public.location_assignments;
create policy "vendors read own assignments"
  on public.location_assignments for select to authenticated
  using (public.has_shop_permission(vendor_id, 'store_edit'));

-- RLS に加えて権限でも閉じる（ポリシーを足し間違えても書けないように）
revoke insert, update, delete on public.location_assignments from anon, authenticated;
