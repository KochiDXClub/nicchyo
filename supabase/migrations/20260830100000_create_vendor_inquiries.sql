-- 出店者⇔運営/市役所 連絡機能: スレッド本体（vendor_inquiries）と返信（vendor_inquiry_replies）
--
-- 背景: #470/#471 参照。出店者が市役所・運営に個別連絡できる窓口がなかったため新設する。
-- 常時チャットではなく、案件ごとにライフサイクルを持つ「スレッド（チケット）」形式。
--
-- topic（用件）の3分類:
--   question      : 質問。まずAIが対応し、未解決なら人手にエスカレーションする想定（#476で実装）。
--   report        : 報告・連絡。返信を前提としない一方向の共有（例: 出店を最後にする、等の定型連絡）。
--   consultation  : 相談。往復のやり取りが前提。
--
-- status は topic によって意味が異なるため、topic ごとに許容値を分けた
-- CHECK 制約で縛る（#471のコメントで「要検討」とされていた点。まず以下の案で実装し、
-- 運用しながら見直す前提）。
--   report       : unconfirmed（未確認） -> confirmed（確認済み）
--   consultation : unhandled（未対応） -> in_progress（検討中） -> resolved（回答済み）
--   question     : ai_pending（AI対応中） -> ai_resolved（AIで解決）
--                                        -> escalated（人手にエスカレーション） -> human_answered（人が回答済み）
--
-- category は宛先マッピング用（#470の「宛先モデル」参照）。市役所ロールは#478で追加予定のため、
-- 現時点では category='city' の行も運営（admin/moderator）が閲覧・代理対応する。
-- 市役所ロール追加後に、category に応じた閲覧制限を追加のマイグレーションで導入する。
--
-- vendor_id は nullable。理由は2つ:
--   1. 運営発信の一般スレッド（出店者に紐づかない、運営⇔市役所間のやり取り）に対応するため
--   2. 出店者アカウントが削除された後も、市役所とのやり取りという性質上、
--      スレッド自体は記録として残す（ON DELETE SET NULL）。他の出店者専有データ
--      （vendor_contents 等）が ON DELETE CASCADE なのとは意図的に扱いを変えている。

create table if not exists public.vendor_inquiries (
  id          uuid        primary key default gen_random_uuid(),
  vendor_id   uuid        references public.vendors(id) on delete set null,
  topic       text        not null
    check (topic in ('question', 'report', 'consultation')),
  category    text        not null
    check (category in ('city', 'operator', 'both')),
  urgency     text        not null default 'normal'
    check (urgency in ('low', 'normal', 'high')),
  body        text        not null,
  image_url   text,
  status      text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint vendor_inquiries_status_matches_topic check (
    (topic = 'report'       and status in ('unconfirmed', 'confirmed'))
    or (topic = 'consultation' and status in ('unhandled', 'in_progress', 'resolved'))
    or (topic = 'question'     and status in ('ai_pending', 'ai_resolved', 'escalated', 'human_answered'))
  )
);

comment on table public.vendor_inquiries is
  '出店者⇔運営/市役所の連絡スレッド本体。topicごとに status の意味・遷移が異なる（vendor_inquiries_status_matches_topic 制約参照）。';
comment on column public.vendor_inquiries.vendor_id is
  'null許容: 運営発信の一般スレッド、および出店者削除後も記録を残すため（ON DELETE SET NULL）。null行の作成はservice_role経由のみ（RLSポリシー参照）。';
comment on column public.vendor_inquiries.category is
  '宛先マッピング用。city向けの実際の閲覧制限は市役所ロール追加後（#478）に別途導入する。';

-- topic に応じて status の初期値を自動設定するトリガー。
-- クライアント側で status を明示的に指定しない INSERT を許容するための補助であり、
-- 明示的に指定された場合はそちらを優先する（NULLのときのみ補完）。
create or replace function public.set_vendor_inquiry_default_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is null then
    new.status := case new.topic
      when 'report' then 'unconfirmed'
      when 'consultation' then 'unhandled'
      when 'question' then 'ai_pending'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists set_vendor_inquiry_default_status on public.vendor_inquiries;

create trigger set_vendor_inquiry_default_status
  before insert on public.vendor_inquiries
  for each row
  execute function public.set_vendor_inquiry_default_status();

-- updated_at の自動更新（ステータス変更の追跡用）
create or replace function public.touch_vendor_inquiries_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_vendor_inquiries_updated_at on public.vendor_inquiries;

create trigger touch_vendor_inquiries_updated_at
  before update on public.vendor_inquiries
  for each row
  execute function public.touch_vendor_inquiries_updated_at();

create index if not exists vendor_inquiries_vendor_id_idx
  on public.vendor_inquiries (vendor_id);
create index if not exists vendor_inquiries_status_idx
  on public.vendor_inquiries (status);
create index if not exists vendor_inquiries_created_at_idx
  on public.vendor_inquiries (created_at desc);

-- ── vendor_inquiry_replies（返信） ──────────────────────────────────────────
-- sender_id は #471 記載のスコープにはないが、複数の運営担当者が対応する場面での
-- 監査証跡として必要なため追加する（market_events.created_by 等、既存の
-- auth.users 参照カラムの慣例に合わせる）。

create table if not exists public.vendor_inquiry_replies (
  id          uuid        primary key default gen_random_uuid(),
  inquiry_id  uuid        not null references public.vendor_inquiries(id) on delete cascade,
  sender_role text        not null
    check (sender_role in ('vendor', 'operator', 'city')),
  sender_id   uuid        references auth.users(id) on delete set null,
  body        text        not null,
  created_at  timestamptz not null default now()
);

comment on table public.vendor_inquiry_replies is
  'vendor_inquiries への返信。sender_role で発言者の立場を区別する。';

create index if not exists vendor_inquiry_replies_inquiry_id_idx
  on public.vendor_inquiry_replies (inquiry_id);
create index if not exists vendor_inquiry_replies_created_at_idx
  on public.vendor_inquiry_replies (created_at);

-- ── RLS: vendor_inquiries ────────────────────────────────────────────
alter table public.vendor_inquiries enable row level security;

-- 出店者は自分のスレッドのみ参照可
drop policy if exists "vendors select own inquiries" on public.vendor_inquiries;
create policy "vendors select own inquiries"
  on public.vendor_inquiries
  for select
  to authenticated
  using (auth.uid() = vendor_id);

-- 出店者は自分名義でのみスレッドを作成可
-- 運営発信の一般スレッド（vendor_id = null）は、authenticatedクライアント向けの
-- INSERTポリシーを設けていない。auth.uid() = null は false 扱いになり誰も通らないため、
-- #472のAPI実装では service_role（RLSをバイパスするサーバーAPI経由）で作成すること。
-- クライアントから直接作らせる要件が出た場合は、別途 operator 向けINSERTポリシーを追加する。
drop policy if exists "vendors insert own inquiries" on public.vendor_inquiries;
create policy "vendors insert own inquiries"
  on public.vendor_inquiries
  for insert
  to authenticated
  with check (auth.uid() = vendor_id);

-- 運営（admin/moderator）は全件参照可
-- vendors.role を直接参照する（JWT app_metadata ではなくDBを信頼起点にする。
-- 20260807120000_restrict_vendors_authenticated_and_role_escalation.sql と同じ理由）
drop policy if exists "operators select all inquiries" on public.vendor_inquiries;
create policy "operators select all inquiries"
  on public.vendor_inquiries
  for select
  to authenticated
  using (
    exists (
      select 1 from public.vendors
      where vendors.id = auth.uid()
        and vendors.role in ('admin', 'moderator')
    )
  );

-- 運営はステータス更新・モデレーションのため全件更新可
-- 出店者本人の更新ポリシーは設けない（提出後は運営側のみが状態を進める想定）
drop policy if exists "operators update all inquiries" on public.vendor_inquiries;
create policy "operators update all inquiries"
  on public.vendor_inquiries
  for update
  to authenticated
  using (
    exists (
      select 1 from public.vendors
      where vendors.id = auth.uid()
        and vendors.role in ('admin', 'moderator')
    )
  )
  with check (
    exists (
      select 1 from public.vendors
      where vendors.id = auth.uid()
        and vendors.role in ('admin', 'moderator')
    )
  );

grant select, insert on public.vendor_inquiries to authenticated;
grant update on public.vendor_inquiries to authenticated;

-- ── RLS: vendor_inquiry_replies ─────────────────────────────────────────────
alter table public.vendor_inquiry_replies enable row level security;

-- 出店者は自分のスレッドに紐づく返信のみ参照可
drop policy if exists "vendors select own inquiry replies" on public.vendor_inquiry_replies;
create policy "vendors select own inquiry replies"
  on public.vendor_inquiry_replies
  for select
  to authenticated
  using (
    exists (
      select 1 from public.vendor_inquiries vi
      where vi.id = vendor_inquiry_replies.inquiry_id
        and vi.vendor_id = auth.uid()
    )
  );

-- 運営は全件参照可
drop policy if exists "operators select all inquiry replies" on public.vendor_inquiry_replies;
create policy "operators select all inquiry replies"
  on public.vendor_inquiry_replies
  for select
  to authenticated
  using (
    exists (
      select 1 from public.vendors
      where vendors.id = auth.uid()
        and vendors.role in ('admin', 'moderator')
    )
  );

-- 出店者は自分のスレッドにのみ、自分の立場（vendor）として返信可
drop policy if exists "vendors insert own inquiry replies" on public.vendor_inquiry_replies;
create policy "vendors insert own inquiry replies"
  on public.vendor_inquiry_replies
  for insert
  to authenticated
  with check (
    sender_role = 'vendor'
    and sender_id = auth.uid()
    and exists (
      select 1 from public.vendor_inquiries vi
      where vi.id = vendor_inquiry_replies.inquiry_id
        and vi.vendor_id = auth.uid()
    )
  );

-- 運営は任意のスレッドに operator/city として返信可
-- （city ロールが未整備の間は、運営が市役所の代理として city 名義でも返信できるようにする。
--   #470「過渡期の仲介・モデレーション責任」を参照）
drop policy if exists "operators insert inquiry replies" on public.vendor_inquiry_replies;
create policy "operators insert inquiry replies"
  on public.vendor_inquiry_replies
  for insert
  to authenticated
  with check (
    sender_role in ('operator', 'city')
    and sender_id = auth.uid()
    and exists (
      select 1 from public.vendors
      where vendors.id = auth.uid()
        and vendors.role in ('admin', 'moderator')
    )
  );

grant select, insert on public.vendor_inquiry_replies to authenticated;

-- DELETE ポリシーは意図的に定義しない（両テーブルとも記録として残す方針のため）。
-- service_role はRLSをバイパスするので、削除が必要な場合は将来的に
-- 明示的な削除APIとポリシーを別途追加すること。

-- 目的: 出店者⇔運営/市役所の個別連絡をスレッド形式で記録するテーブルを新設する。
-- anon には一切権限を付与しない（ログイン済みの出店者・運営のみが利用する機能のため）。
