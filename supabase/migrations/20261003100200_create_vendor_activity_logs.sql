-- 出店者アカウント構造の刷新 (3/3): 店舗の操作ログ（メンバーを含む「誰が何をしたか」）。
--
-- 1行 = 店舗に対する重要な操作 1 回。複数人で 1 店舗を触るため、
-- 「誰が商品を消したか」「誰が招待リンクを出したか」を後から追えるようにする。
--
-- 記録するもの: 店舗情報の更新、近況の投稿・削除、メンバーの追加・削除・権限変更、
--               招待リンク・QR の発行と無効化、代表者の引き継ぎ、問い合わせの送信 など
-- 記録しないもの: 閲覧、保存の連打のような細かい操作（ノイズで本当に見たい行が埋もれるため）
--
-- 見られる人:
--   - 出店者側: その店舗の代表者と、audit_view 権限を付けたメンバー（自店舗の行だけ）
--   - 運営: 管理画面から全店舗（service_role 経由）
-- 書き込みは API（service_role）だけ。ブラウザからの追加・更新・削除はできない（追記専用）。
--
-- actor_name は書いた時点の表示名のスナップショット。アカウントが消えても「誰だったか」が残る。
-- ログに残すのは操作の事実だけで、メールアドレスや電話番号などの個人情報は入れない。

create table if not exists public.vendor_activity_logs (
  id          bigserial primary key,
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  actor_id    uuid references auth.users (id) on delete set null,
  actor_name  text,
  action      text not null,
  target_type text,
  target_id   text,
  summary     text not null,
  details     jsonb,
  created_at  timestamptz not null default now(),

  constraint vendor_activity_logs_action_format check (action ~ '^[a-z][a-z0-9_.]{0,59}$'),
  constraint vendor_activity_logs_summary_length check (char_length(summary) <= 500),
  constraint vendor_activity_logs_actor_name_length check (actor_name is null or char_length(actor_name) <= 100)
);

comment on table public.vendor_activity_logs is
  '店舗の操作ログ（追記専用）。代表者と audit_view 権限のメンバーが自店舗分を読める。書き込みは service_role のみ。';
comment on column public.vendor_activity_logs.action is
  '操作の種類。例: member.add / member.remove / member.permissions / invite.create / invite.revoke / qr.reissue / owner.transfer / store.update / post.create';
comment on column public.vendor_activity_logs.summary is
  '画面にそのまま出す一文（例: 「商品を3件更新」）。個人情報は入れない。';

create index if not exists vendor_activity_logs_vendor_created_idx
  on public.vendor_activity_logs (vendor_id, created_at desc);

-- actor_id は on delete set null の相手側。アカウント削除時の全走査を避ける。
create index if not exists vendor_activity_logs_actor_id_idx
  on public.vendor_activity_logs (actor_id);

alter table public.vendor_activity_logs enable row level security;

revoke all on public.vendor_activity_logs from anon, authenticated;
grant select on public.vendor_activity_logs to authenticated;

drop policy if exists "members read own shop activity logs" on public.vendor_activity_logs;
create policy "members read own shop activity logs"
  on public.vendor_activity_logs for select to authenticated
  using (public.has_shop_permission(vendor_id, 'audit_view'));
