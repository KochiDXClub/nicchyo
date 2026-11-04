-- 新しい非公開バケットの境界を、実際のanon/authenticatedロールで検証する。
-- すべてテスト用の行。成功時も失敗時もセッションを閉じれば実データに残さない。
begin;
insert into auth.users (id, email) values
 ('ee000001-0000-4000-8000-000000000001', 'security-owner@example.invalid'),
 ('ee000001-0000-4000-8000-000000000002', 'security-outsider@example.invalid'),
 ('ee000001-0000-4000-8000-000000000003', 'security-member@example.invalid');
insert into public.vendors (id, shop_name) values
 ('ee000002-0000-4000-8000-000000000001', 'Security regression fixture');
insert into public.shop_members (vendor_id, user_id, role, permissions) values
 ('ee000002-0000-4000-8000-000000000001', 'ee000001-0000-4000-8000-000000000001', 'owner', '{}'),
 ('ee000002-0000-4000-8000-000000000001', 'ee000001-0000-4000-8000-000000000003', 'member', '{}');
insert into storage.objects (bucket_id, name) values
 ('vendor-inquiry-images', 'ee000002-0000-4000-8000-000000000001/inquiries/secret.webp'),
 ('vendor-images', 'ee000002-0000-4000-8000-000000000001/inquiries/legacy.webp'),
 ('vendor-images', 'ee000002-0000-4000-8000-000000000001/store-main.webp');
do $$ begin
  if (select public from storage.buckets where id = 'vendor-inquiry-images') is distinct from false then
    raise exception 'Inquiry bucket must be private';
  end if;
  if not has_table_privilege('service_role', 'public.web_page_analytics', 'INSERT') then
    raise exception 'API service role must retain analytics INSERT';
  end if;
end $$;

set local role anon;
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'vendor-inquiry-images') then
    raise exception 'anon can read private attachments';
  end if;
  if exists (select 1 from storage.objects where name = 'ee000002-0000-4000-8000-000000000001/inquiries/legacy.webp') then
    raise exception 'anon can enumerate legacy attachments';
  end if;
  if not exists (select 1 from storage.objects where name = 'ee000002-0000-4000-8000-000000000001/store-main.webp') then
    raise exception 'Public shop photos must remain readable';
  end if;
  begin
    insert into public.web_page_analytics (visit_date, visitor_key, path, duration_seconds)
    values (current_date, 'security-fixture', '/map', 1);
    raise exception 'anon bypassed analytics API';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ee000001-0000-4000-8000-000000000001","app_metadata":{"role":"vendor"}}', true);
do $$ begin
  if not exists (select 1 from storage.objects where bucket_id = 'vendor-inquiry-images') then
    raise exception 'Owner cannot read own attachment';
  end if;
  insert into storage.objects (bucket_id, name)
  values ('vendor-inquiry-images', 'ee000002-0000-4000-8000-000000000001/inquiries/new.webp');
  begin
    insert into storage.objects (bucket_id, name)
    values ('vendor-images', 'ee000002-0000-4000-8000-000000000001/inquiries/blocked.webp');
    raise exception 'Owner uploaded attachment to public bucket';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.web_page_analytics (visit_date, visitor_key, path, duration_seconds)
    values (current_date, 'security-fixture', '/map', 1);
    raise exception 'authenticated bypassed analytics API';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"ee000001-0000-4000-8000-000000000002","user_metadata":{"role":"admin"}}', true);
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'vendor-inquiry-images') then
    raise exception 'Outsider or forged user_metadata can read private attachment';
  end if;
  begin
    insert into storage.objects (bucket_id, name)
    values ('vendor-inquiry-images', 'ee000002-0000-4000-8000-000000000001/inquiries/foreign.webp');
    raise exception 'Outsider can upload to another shop';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"ee000001-0000-4000-8000-000000000003","app_metadata":{"role":"vendor"}}', true);
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'vendor-inquiry-images') then
    raise exception 'Member without inquiries permission can read attachment';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"ee000001-0000-4000-8000-000000000002","app_metadata":{"role":"moderator"}}', true);
do $$ begin
  if not exists (select 1 from storage.objects where bucket_id = 'vendor-inquiry-images') then
    raise exception 'Authorized operator cannot read attachment';
  end if;
end $$;
reset role;
rollback;
