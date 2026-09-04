-- 運営（admin / moderator）判定を auth.users の app_metadata.role を単一の情報源とするヘルパーに集約し、
-- vendor_inquiries / vendor_inquiry_replies の運営向けポリシーを差し替える
--
-- 背景（#528）:
--   20260830100000_create_vendor_inquiries.sql は運営判定を
--     exists (select 1 from public.vendors where vendors.id = auth.uid() and vendors.role in ('admin','moderator'))
--   と書き、コメントで「JWT app_metadata ではなくDBを信頼起点にする」と説明していた。
--   しかしその後の調査で、この前提が成り立っていないことが分かった。
--
--   - public.vendors は scripts/create-vendors.js が作る300店舗の「店舗テーブル」であり、
--     scripts/create-admin-user.mjs は vendors 行を作らない。auth.users への INSERT を
--     フックして vendors 行を作るトリガーも存在しない。
--     つまり管理者アカウントには vendors 行が無く、上記の exists は常に false になりうる。
--   - vendors.role を更新するアプリコードは1件も存在しない。INSERT時は
--     prevent_vendor_privilege_escalation トリガーが new.role := 'vendor' に強制するため、
--     vendors.role は実質 'vendor' で固定されている。
--   - 一方、管理画面のユーザー管理（一覧・招待・ロール変更）はすべて
--     auth.users の app_metadata.role だけで動いている（app/api/admin/users/）。
--
--   結果として、この機能のロールの単一情報源は auth.users であり、vendors.role ではない。
--   なお app_metadata の実体は auth.users.raw_app_meta_data というDBのカラムなので、
--   これは「DBを信頼しない」という選択ではなく「信頼起点を vendors から auth.users に移す」という選択である。
--
-- 方針:
--   判定ロジックをヘルパー関数に集約する。将来ロール専用テーブルを新設する場合も、
--   この関数の中身を差し替えるだけで全ポリシーが追随できる。
--
-- 注意:
--   user_metadata（auth.users.raw_user_meta_data）は supabase.auth.updateUser() で
--   ユーザー自身が書き換えられるため、認可判定に使ってはならない。
--   ここでは app_metadata のみを参照する（lib/auth/permissions.ts の getRole と同じ挙動）。
--
--   将来ロール専用テーブルを新設してこの関数から参照する場合は、テーブル読み取りが
--   RLS を再帰的に呼ぶのを避けるため security definer + set search_path = ''（完全修飾）が
--   必要になる。現在はテーブルを一切読まず auth.jwt() だけを見るため、
--   security definer にしてはならない（RLS をバイパスできる関数を不要に公開することになる）。

-- ── ヘルパー関数 ──────────────────────────────────────────────────────

create or replace function public.current_user_role()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

comment on function public.current_user_role() is
  'リクエスト元ユーザーのロールを app_metadata.role から取得する。user_metadata はユーザー自身が書き換えられるため参照しない。';

create or replace function public.is_operator()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'moderator');
$$;

comment on function public.is_operator() is
  '運営（admin / moderator）かどうかを判定する。市役所ロールは #478 で追加予定のため、その時点で is_city() 等を別途用意する。';

-- 呼び出し元自身のロールを返すだけなので PUBLIC 実行でも情報は漏れないが、
-- 多層防御として実際に必要なロールだけに絞る
revoke execute on function public.current_user_role() from public;
revoke execute on function public.is_operator() from public;
grant execute on function public.current_user_role(), public.is_operator()
  to authenticated, service_role;

-- ── vendor_inquiries の運営向けポリシーを差し替え ────────────────────────
-- 出店者向けポリシー（vendors select/insert own inquiries）は auth.uid() = vendor_id の
-- 本人判定でありロールに依存しないため、変更しない。

drop policy if exists "operators select all inquiries" on public.vendor_inquiries;
create policy "operators select all inquiries"
  on public.vendor_inquiries
  for select
  to authenticated
  using (public.is_operator());

drop policy if exists "operators update all inquiries" on public.vendor_inquiries;
create policy "operators update all inquiries"
  on public.vendor_inquiries
  for update
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());

-- ── vendor_inquiry_replies の運営向けポリシーを差し替え ──────────────────

drop policy if exists "operators select all inquiry replies" on public.vendor_inquiry_replies;
create policy "operators select all inquiry replies"
  on public.vendor_inquiry_replies
  for select
  to authenticated
  using (public.is_operator());

drop policy if exists "operators insert inquiry replies" on public.vendor_inquiry_replies;
create policy "operators insert inquiry replies"
  on public.vendor_inquiry_replies
  for insert
  to authenticated
  with check (
    sender_role in ('operator', 'city')
    and sender_id = auth.uid()
    and public.is_operator()
  );

-- 目的: 運営判定の情報源を vendors.role から auth.users の app_metadata.role に移し、
--       判定ロジックをヘルパー関数1箇所に集約する。
--       他テーブルの vendors.role 参照ポリシーの移行は別途対応する（#528）。
