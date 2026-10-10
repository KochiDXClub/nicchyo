-- サイト内のお知らせ（来訪者向け）。運営が投稿し、地図のページの上部と /news に出す。
--
-- 設定の「公開お知らせ」（system_settings.public の publicAnnouncement／publicAnnouncementEnabled）は、
-- 保存するだけでどの画面にも出ていなかった。ここへ完全に移し、設定からは外す。
--   - 有効で本文が空でなかったものは、公開中のお知らせ1件として引き継ぐ
--   - 設定の2つのキーは取り除く
--
-- 読み書きはすべてサーバーの service_role 経由（来訪者向けの API／ページが公開期間内のものだけを返す）。
-- Supabase は新しいテーブルに anon / authenticated の全権限を付けるので、すべて剥がす。

create table if not exists public.site_announcements (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null check (char_length(title) between 1 and 80),
  body        text        not null check (char_length(body) between 1 and 2000),
  -- 重要なお知らせは、バナーで目立たせる
  important   boolean     not null default false,
  -- false の間は、公開期間内でも出さない（下書き・取り下げ）
  published   boolean     not null default true,
  -- 公開期間。ends_at が null なら終了日なし
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  created_by  uuid        references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint site_announcements_period_check check (ends_at is null or ends_at > starts_at)
);

create index if not exists site_announcements_starts_at_idx on public.site_announcements (starts_at desc);

alter table public.site_announcements enable row level security;
revoke all on public.site_announcements from anon, authenticated;

comment on table public.site_announcements is
  'サイト内のお知らせ（来訪者向け）。公開期間（starts_at〜ends_at）内で published のものを、地図ページの上部と /news に出す。読み書きは service_role のみ。';

-- 設定の「公開お知らせ」を引き継ぐ（有効で、本文が空でないときだけ）
insert into public.site_announcements (title, body, important, published, starts_at)
select '運営からのお知らせ', left(btrim(value ->> 'publicAnnouncement'), 2000), false, true, now()
from public.system_settings
where key = 'public'
  and coalesce((value ->> 'publicAnnouncementEnabled')::boolean, false)
  and btrim(coalesce(value ->> 'publicAnnouncement', '')) <> '';

update public.system_settings
set value = value - 'publicAnnouncementEnabled' - 'publicAnnouncement'
where key = 'public';
