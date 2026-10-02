-- 出店者アカウント構造の刷新 (2/3): 「本人の行だけ」から「その店舗のメンバーで、権限がある人」へ。
--
-- これまでの RLS は auth.uid() = vendor_id（ログインした本人＝店舗）だった。
-- 20261003100000 で入れた has_shop_permission(店舗, 権限) に置き換える。
--
--   store_edit … vendors / products / location_assignments / product_sales / vendor_weekly_status /
--                Storage(vendor-images)
--   post       … vendor_contents / Storage(vendor-images)
--   ai_notes   … store_knowledge / vendor_ai_settings
--   inquiries  … vendor_inquiries / vendor_inquiry_replies
--   analytics  … shop_page_views / ai_consult_logs / content_reactions
--   (代表者だけ) vendor_owner_profiles（個人情報）
--   (権限不要・メンバーなら誰でも) vendor_tour_seen
--
-- 公開読み取り（public read …）と運営（admin / moderator）のポリシーは触らない。
-- 運営ポリシーが vendors.id = auth.uid() で判定している箇所は、運営アカウントの扱い（別件）で直す。
-- 返信の sender_id は「実際に書いた人」の auth.uid() のまま残す（誰が書いたか分かるように）。

-- ── vendors ───────────────────────────────────────────────────────────
-- 店舗行の新規作成（"vendor insert self"）は 20261003100000 で閉じた（店舗は service_role だけが作る）。
drop policy if exists "vendor update self" on public.vendors;
create policy "vendor update self"
  on public.vendors for update to authenticated
  using (public.has_shop_permission(id, 'store_edit'))
  with check (public.has_shop_permission(id, 'store_edit'));

-- ── vendor_contents（近況） ────────────────────────────────────────────
-- 読むだけは analytics でも許す（分析で期限切れ・非表示の投稿の反応まで数えるため。
-- content_reactions の判定が、このテーブルの行を見られることを前提にしている）
drop policy if exists "vendors can read own contents" on public.vendor_contents;
create policy "vendors can read own contents"
  on public.vendor_contents for select to authenticated
  using (
    public.has_shop_permission(vendor_id, 'post')
    or public.has_shop_permission(vendor_id, 'analytics')
  );

drop policy if exists "vendors can insert own contents" on public.vendor_contents;
create policy "vendors can insert own contents"
  on public.vendor_contents for insert to authenticated
  with check (public.has_shop_permission(vendor_id, 'post'));

drop policy if exists "vendors can update own contents" on public.vendor_contents;
create policy "vendors can update own contents"
  on public.vendor_contents for update to authenticated
  using (public.has_shop_permission(vendor_id, 'post'))
  with check (public.has_shop_permission(vendor_id, 'post'));

drop policy if exists "vendors can delete own contents" on public.vendor_contents;
create policy "vendors can delete own contents"
  on public.vendor_contents for delete to authenticated
  using (public.has_shop_permission(vendor_id, 'post'));

-- ── 店舗情報まわり（store_edit） ────────────────────────────────────────
drop policy if exists "vendors manage own products" on public.products;
create policy "vendors manage own products"
  on public.products for all to authenticated
  using (public.has_shop_permission(vendor_id, 'store_edit'))
  with check (public.has_shop_permission(vendor_id, 'store_edit'));

drop policy if exists "vendors manage own assignments" on public.location_assignments;
create policy "vendors manage own assignments"
  on public.location_assignments for all to authenticated
  using (public.has_shop_permission(vendor_id, 'store_edit'))
  with check (public.has_shop_permission(vendor_id, 'store_edit'));

drop policy if exists "vendors can manage own product_sales" on public.product_sales;
create policy "vendors can manage own product_sales"
  on public.product_sales for all to authenticated
  using (public.has_shop_permission(vendor_id, 'store_edit'))
  with check (public.has_shop_permission(vendor_id, 'store_edit'));

drop policy if exists "vendors manage own weekly status" on public.vendor_weekly_status;
create policy "vendors manage own weekly status"
  on public.vendor_weekly_status for all to authenticated
  using (public.has_shop_permission(vendor_id, 'store_edit'))
  with check (public.has_shop_permission(vendor_id, 'store_edit'));

-- 出店者本人の氏名（公開/非公開は出店者が管理）。個人情報なので、権限ではなく代表者だけに限る。
drop policy if exists "vendors read own owner profile" on public.vendor_owner_profiles;
create policy "vendors read own owner profile"
  on public.vendor_owner_profiles for select to authenticated
  using (public.is_shop_owner(vendor_id));

drop policy if exists "vendors insert own owner profile" on public.vendor_owner_profiles;
create policy "vendors insert own owner profile"
  on public.vendor_owner_profiles for insert to authenticated
  with check (public.is_shop_owner(vendor_id));

drop policy if exists "vendors update own owner profile" on public.vendor_owner_profiles;
create policy "vendors update own owner profile"
  on public.vendor_owner_profiles for update to authenticated
  using (public.is_shop_owner(vendor_id))
  with check (public.is_shop_owner(vendor_id));

-- ── にちよさんの覚えごと（ai_notes） ────────────────────────────────────
drop policy if exists "vendors manage own knowledge" on public.store_knowledge;
create policy "vendors manage own knowledge"
  on public.store_knowledge for all to authenticated
  using (public.has_shop_permission(store_id, 'ai_notes'))
  with check (public.has_shop_permission(store_id, 'ai_notes'));

drop policy if exists "vendors read own ai settings" on public.vendor_ai_settings;
create policy "vendors read own ai settings"
  on public.vendor_ai_settings for select to authenticated
  using (public.has_shop_permission(vendor_id, 'ai_notes'));

drop policy if exists "vendors insert own ai settings" on public.vendor_ai_settings;
create policy "vendors insert own ai settings"
  on public.vendor_ai_settings for insert to authenticated
  with check (public.has_shop_permission(vendor_id, 'ai_notes'));

drop policy if exists "vendors update own ai settings" on public.vendor_ai_settings;
create policy "vendors update own ai settings"
  on public.vendor_ai_settings for update to authenticated
  using (public.has_shop_permission(vendor_id, 'ai_notes'))
  with check (public.has_shop_permission(vendor_id, 'ai_notes'));

-- ── 運営・市役所とのやりとり（inquiries） ───────────────────────────────
drop policy if exists "vendors select own inquiries" on public.vendor_inquiries;
create policy "vendors select own inquiries"
  on public.vendor_inquiries for select to authenticated
  using (public.has_shop_permission(vendor_id, 'inquiries'));

drop policy if exists "vendors insert own inquiries" on public.vendor_inquiries;
create policy "vendors insert own inquiries"
  on public.vendor_inquiries for insert to authenticated
  with check (public.has_shop_permission(vendor_id, 'inquiries'));

drop policy if exists "vendors select own inquiry replies" on public.vendor_inquiry_replies;
create policy "vendors select own inquiry replies"
  on public.vendor_inquiry_replies for select to authenticated
  using (
    exists (
      select 1 from public.vendor_inquiries vi
      where vi.id = vendor_inquiry_replies.inquiry_id
        and public.has_shop_permission(vi.vendor_id, 'inquiries')
    )
  );

drop policy if exists "vendors insert own inquiry replies" on public.vendor_inquiry_replies;
create policy "vendors insert own inquiry replies"
  on public.vendor_inquiry_replies for insert to authenticated
  with check (
    sender_role = 'vendor'
    and sender_id = (select auth.uid())
    and exists (
      select 1 from public.vendor_inquiries vi
      where vi.id = vendor_inquiry_replies.inquiry_id
        and public.has_shop_permission(vi.vendor_id, 'inquiries')
    )
  );

-- ── お店の分析（analytics） ─────────────────────────────────────────────
drop policy if exists "vendors can read own page views" on public.shop_page_views;
create policy "vendors can read own page views"
  on public.shop_page_views for select to authenticated
  using (public.has_shop_permission(vendor_id, 'analytics'));

-- ai_consult_logs.store_id は text（店舗の uuid を文字にしたもの）
drop policy if exists "vendors can read own store logs" on public.ai_consult_logs;
create policy "vendors can read own store logs"
  on public.ai_consult_logs for select to authenticated
  using (
    exists (
      select 1 from public.vendors v
      where v.id::text = ai_consult_logs.store_id
        and public.has_shop_permission(v.id, 'analytics')
    )
  );

drop policy if exists "vendors can read reactions on own contents" on public.content_reactions;
create policy "vendors can read reactions on own contents"
  on public.content_reactions for select to authenticated
  using (
    exists (
      select 1 from public.vendor_contents vc
      where vc.id = content_reactions.vendor_content_id
        and public.has_shop_permission(vc.vendor_id, 'analytics')
    )
  );

-- ── 説明パネルを見た記録（メンバーなら誰でも） ──────────────────────────
drop policy if exists "vendors read own tour seen" on public.vendor_tour_seen;
create policy "vendors read own tour seen"
  on public.vendor_tour_seen for select to authenticated
  using (public.is_shop_member(vendor_id));

drop policy if exists "vendors insert own tour seen" on public.vendor_tour_seen;
create policy "vendors insert own tour seen"
  on public.vendor_tour_seen for insert to authenticated
  with check (public.is_shop_member(vendor_id));

-- ── Storage: vendor-images ─────────────────────────────────────────────
-- 先頭のフォルダ名が店舗ID。置ける・上書きできる・消せるのは、ファイルの種類に応じた権限を持つメンバーだけ。
-- 既存の公開URL（店舗写真のサムネイルは、メイン画像のURLから組み立てている）を壊さないよう、保存先のパスは変えず、
-- ファイル名の形で用途を見分ける。
--   <店舗ID>/inquiries/…                      … inquiries（運営・市役所との連絡の添付）
--   <店舗ID>/store-main.* / store-thumb.* / product-*  … store_edit（店舗・商品の写真）
--   <店舗ID>/<日時>.<拡張子> など上記以外      … post（近況の写真）
-- 代表者は、どの種類でも操作できる。

create or replace function public.vendor_image_permission(object_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when (string_to_array(object_name, '/'))[2] = 'inquiries' then 'inquiries'
    when (string_to_array(object_name, '/'))[array_length(string_to_array(object_name, '/'), 1)] ~ '^(store-main\.|store-thumb\.|product-)' then 'store_edit'
    else 'post'
  end;
$$;

comment on function public.vendor_image_permission(text) is
  'vendor-images のファイルを操作するのに要る権限キー。パスの形（inquiries/・店舗/商品写真の名前・それ以外）で決める。';

drop policy if exists "vendors can upload own images" on storage.objects;
create policy "vendors can upload own images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vendor-images'
    and exists (
      select 1 from public.shop_members m
      where m.vendor_id::text = (storage.foldername(name))[1]
        and m.user_id = (select auth.uid())
        and (m.role = 'owner' or public.vendor_image_permission(name) = any (m.permissions))
    )
  );

drop policy if exists "vendors can update own images" on storage.objects;
create policy "vendors can update own images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'vendor-images'
    and exists (
      select 1 from public.shop_members m
      where m.vendor_id::text = (storage.foldername(name))[1]
        and m.user_id = (select auth.uid())
        and (m.role = 'owner' or public.vendor_image_permission(name) = any (m.permissions))
    )
  )
  with check (
    bucket_id = 'vendor-images'
    and exists (
      select 1 from public.shop_members m
      where m.vendor_id::text = (storage.foldername(name))[1]
        and m.user_id = (select auth.uid())
        and (m.role = 'owner' or public.vendor_image_permission(name) = any (m.permissions))
    )
  );

drop policy if exists "vendors can delete own images" on storage.objects;
create policy "vendors can delete own images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'vendor-images'
    and exists (
      select 1 from public.shop_members m
      where m.vendor_id::text = (storage.foldername(name))[1]
        and m.user_id = (select auth.uid())
        and (m.role = 'owner' or public.vendor_image_permission(name) = any (m.permissions))
    )
  );
