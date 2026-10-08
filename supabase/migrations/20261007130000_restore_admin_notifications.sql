-- admin_notifications テーブルを復元する（#425）
--
-- 背景:
--   20260320000003_create_admin_notifications.sql で作成した admin_notifications は、
--   20260414081611_remote_schema.sql（本番スキーマのスナップショット）の
--   `drop table "public"."admin_notifications";` で削除され、その後どのマイグレーションでも
--   再作成されていない。全マイグレーションを頭から適用した DB には存在せず、
--   次のコードが失敗する（本番に有るかは未確認。有る場合は create ... if not exists が何もしない）。
--     - app/api/admin/notifications/route.ts（通知ベルの一覧・既読）
--     - app/(public)/admin/dashboard/page.tsx（未読件数）
--     - app/api/reports/route.ts / app/api/contact/route.ts / lib/grandma/abuseDetection.ts（INSERT）
--
-- 方針:
--   - 列は当初定義と同じ（type, title, body, link, is_read, created_at）。
--   - 書き込み（INSERT / 既読 UPDATE）は上記 API がすべて service_role で行う。
--   - 運営（admin / moderator）は authenticated でも読める・既読にできる。判定は is_operator()
--     （app_metadata.role。vendors.role は参照しない: 20260904090000 を参照）。
--   - anon は一切触れない。
--   - kotodutes は既に削除されているため、旧 notify_kotodute_reported のトリガーは復元しない。

create table if not exists public.admin_notifications (
  id          uuid        primary key default gen_random_uuid(),
  type        text        not null,
  title       text        not null,
  body        text,
  link        text,
  is_read     boolean     not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.admin_notifications is
  '運営向け通知（通報・問い合わせ・AI不正ブロックなど）。書き込みは service_role の API のみ。';

create index if not exists admin_notifications_is_read_idx
  on public.admin_notifications (is_read);
create index if not exists admin_notifications_created_at_idx
  on public.admin_notifications (created_at desc);

alter table public.admin_notifications enable row level security;

drop policy if exists "admin_notifications_select_admin" on public.admin_notifications;
drop policy if exists "admin_notifications_update_admin" on public.admin_notifications;
drop policy if exists "operators select admin_notifications" on public.admin_notifications;
drop policy if exists "operators update admin_notifications" on public.admin_notifications;

create policy "operators select admin_notifications"
  on public.admin_notifications
  for select
  to authenticated
  using ((select public.is_operator()));

create policy "operators update admin_notifications"
  on public.admin_notifications
  for update
  to authenticated
  using ((select public.is_operator()))
  with check ((select public.is_operator()));

revoke all on table public.admin_notifications from public, anon, authenticated;
grant select, update on table public.admin_notifications to authenticated;
grant all on table public.admin_notifications to service_role;
