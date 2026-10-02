-- 出店者アカウント構造の刷新 (1/3): 「店舗」と「ログインアカウント」を分け、メンバーで紐づける。
--
-- これまで vendors.id = auth.users.id（1ユーザー＝1店舗）に固定していた。
-- 今後は 1店舗に複数アカウント（代表者1人＋メンバー最大数人）を紐づけ、
-- メンバーごとに操作権限を細かく付け外しできるようにする。
--
--   vendors.id            … 店舗のキー。約20テーブルと Storage のフォルダ名が参照しているので値は変えない
--   shop_members          … 誰がどの店舗に入っているか（今回の主役）
--   has_shop_permission() … RLS と API が使う唯一の判定関数
--
-- 権限キー（permissions に入れてよい値。増やすときは check と has_shop_permission の呼び出し側を揃える）
--   store_edit      店舗情報・商品・写真・出店日の編集
--   post            近況の投稿・出し直し
--   ai_notes        にちよさんの覚えごとの確認・修正・削除
--   inquiries       運営・市役所とのやりとり
--   analytics       お店の分析の閲覧
--   audit_view      操作ログの閲覧
--   members_manage  招待リンク・QR・メンバーの権限変更（管理者一歩手前。引き継ぎ・退会・代表者の変更はできない）
-- 代表者(owner)は permissions の中身にかかわらず全権限を持つ。
--
-- 本テーブルへの書き込みは API（service_role）だけが行う。ブラウザからは読むだけ。

create table if not exists public.shop_members (
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'member',
  permissions text[] not null default '{}',
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (vendor_id, user_id),
  constraint shop_members_role_check check (role in ('owner', 'member')),
  constraint shop_members_permissions_check check (
    permissions <@ array[
      'store_edit', 'post', 'ai_notes', 'inquiries', 'analytics', 'audit_view', 'members_manage'
    ]::text[]
  )
);

comment on table public.shop_members is
  '店舗とログインアカウントの紐づけ。role=owner は店舗ごとに1人（全権限）、member は permissions に入れた操作だけできる。書き込みは service_role のみ。';
comment on column public.shop_members.permissions is
  'メンバーに許す操作のキー配列。owner では参照しない（常に全権限）。';

-- 代表者は店舗ごとに1人まで
create unique index if not exists shop_members_one_owner_per_shop
  on public.shop_members (vendor_id) where role = 'owner';

-- 1アカウントが入れる店舗は1つ（AuthContext が vendorId を1つに決められるようにする）。
-- 将来「複数店舗を持つ人」を許すときは、この索引を外して店舗の切り替え UI を足す。
create unique index if not exists shop_members_one_shop_per_user
  on public.shop_members (user_id);

create index if not exists shop_members_vendor_id_idx
  on public.shop_members (vendor_id);

-- ── 判定関数 ──────────────────────────────────────────────────────────
-- security definer にするのは、shop_members 自身の RLS から呼んでも再帰しないようにするため。
-- search_path を空にして、呼び出し側が差し替えたテーブルを読まされないようにする。

create or replace function public.has_shop_permission(p_vendor_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_members m
    where m.vendor_id = p_vendor_id
      and m.user_id = (select auth.uid())
      and (m.role = 'owner' or p_permission = any (m.permissions))
  );
$$;

comment on function public.has_shop_permission(uuid, text) is
  '呼び出し元アカウントが、その店舗で指定の操作をしてよいか。代表者は常に true。';

create or replace function public.is_shop_member(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_members m
    where m.vendor_id = p_vendor_id
      and m.user_id = (select auth.uid())
  );
$$;

comment on function public.is_shop_member(uuid) is
  '呼び出し元アカウントが、その店舗のメンバー（代表者を含む）か。';

-- anon にも付けるのは、anon を含む役割のポリシー式からも評価されるため（auth.uid() が null なので false を返すだけ）。
revoke all on function public.has_shop_permission(uuid, text) from public;
revoke all on function public.is_shop_member(uuid) from public;
grant execute on function public.has_shop_permission(uuid, text) to anon, authenticated, service_role;
grant execute on function public.is_shop_member(uuid) to anon, authenticated, service_role;

-- ── shop_members の RLS（読むだけ） ─────────────────────────────────────
alter table public.shop_members enable row level security;

revoke all on public.shop_members from anon, authenticated;
grant select on public.shop_members to authenticated;

-- 自分の店舗のメンバー一覧は、メンバー全員が読める（誰が入っているかは隠さない）
drop policy if exists "members read own shop members" on public.shop_members;
create policy "members read own shop members"
  on public.shop_members for select to authenticated
  using (public.is_shop_member(vendor_id));

-- ── 店舗が auth.users に縛られないようにする ────────────────────────────
-- 本番は店舗データを先に入れ、出店者が QR で後から紐づく。
-- そのため「アカウントのない店舗」が存在できる必要がある。

do $$
declare
  con record;
begin
  -- 制約名に依存せず、vendors.id → auth.users の外部キーだけを探して外す
  for con in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.vendors'::regclass
      and c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.vendors drop constraint %I', con.conname);
  end loop;
end;
$$;

-- vendors を指す形に付け替える（既存行に孤児があっても止まらないよう not valid。
-- 新しい行から効く。全件検証は、孤児が無いことを確かめてから validate constraint で行う）
alter table public.shop_attendance_vendor
  drop constraint if exists shop_attendance_vendor_vendor_id_fkey;
alter table public.shop_attendance_vendor
  add constraint shop_attendance_vendor_vendor_id_fkey
  foreign key (vendor_id) references public.vendors (id) on delete cascade not valid;

alter table public.vendor_notice_reads
  drop constraint if exists vendor_notice_reads_vendor_id_fkey;
alter table public.vendor_notice_reads
  add constraint vendor_notice_reads_vendor_id_fkey
  foreign key (vendor_id) references public.vendors (id) on delete cascade not valid;

-- ── 既存の出店者を代表者として移す ──────────────────────────────────────
-- 開発・検証用 DB では、これまでのログイン済み出店者がそのまま代表者になる。
-- 本番 DB は店舗データを先に入れてアカウントなしで始めるため、ここは 0 件で何も起きない。
insert into public.shop_members (vendor_id, user_id, role)
select v.id, v.id, 'owner'
from public.vendors v
join auth.users u on u.id = v.id
where coalesce(v.role, 'vendor') = 'vendor'
on conflict do nothing;

-- 旧来のスクリプト（scripts/create-vendors*.js）は vendors.id = ユーザーID で行を作る。
-- それでも代表者が付くよう、同じ ID のアカウントがあれば代表者として自動で入れる。
create or replace function public.add_owner_member_for_legacy_vendor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.role, 'vendor') = 'vendor'
     and exists (select 1 from auth.users u where u.id = new.id) then
    insert into public.shop_members (vendor_id, user_id, role)
    values (new.id, new.id, 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.add_owner_member_for_legacy_vendor() from public;

drop trigger if exists vendors_add_owner_member on public.vendors;
create trigger vendors_add_owner_member
  after insert on public.vendors
  for each row execute function public.add_owner_member_for_legacy_vendor();
