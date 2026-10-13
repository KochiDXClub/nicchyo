-- 近況（vendor_contents）の公開状態（status）と投稿日時（created_at）を、出店者が直接変えられないようにする。
--
-- 背景:
--   20261003100100 の "vendors can insert/update own contents" は列を絞っておらず、post 権限の店舗メンバーが
--   PostgREST で直接 status・created_at を書き換えられた。
--     - 運営が /api/admin/content/[id] で非表示（hidden）にした投稿を、出店者が active に戻せる
--     - created_at を未来の日時にして、公開フィード（created_at の新しい順・31 日窓）の先頭に居座れる
--   アプリの出店者画面（app/vendor/_services/postsService.ts）は insert で status・created_at を渡しておらず、
--   update もしていないので、この制限で出店者の操作は何も変わらない。
--
-- 方針（vendors の prevent_vendor_listing_consent_change と同じ形）:
--   - 運営の API（service_role）・DB 管理者・運営ロール（admin / moderator）はそのまま通す
--   - それ以外の INSERT は status = 'active'・created_at = now() に固定する
--   - それ以外の UPDATE で status・created_at を変えようとしたら拒否する
--
-- 冪等: create or replace function / drop trigger if exists → create trigger。

create or replace function public.guard_vendor_contents_moderation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  -- 運営 API は service_role で書くが、キー未設定時は運営本人のセッションで書く（createAdminClient() ?? supabase）
  if current_user = 'authenticated' and (select public.is_operator()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'active';
    new.created_at := now();
    return new;
  end if;

  if new.status is distinct from old.status
     or new.created_at is distinct from old.created_at then
    raise exception '近況の公開状態と投稿日時は運営だけが変更できます'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_vendor_contents_moderation() is
  '出店者が vendor_contents の status（運営の非表示）と created_at（並び順）を直接変えられないようにするトリガ関数。';

drop trigger if exists guard_vendor_contents_moderation on public.vendor_contents;
create trigger guard_vendor_contents_moderation
  before insert or update on public.vendor_contents
  for each row
  execute function public.guard_vendor_contents_moderation();
