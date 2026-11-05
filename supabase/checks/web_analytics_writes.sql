-- 匿名・認証ユーザーは直接書けず、APIのservice roleだけが書ける。
begin;
do $$ begin
  if not has_table_privilege('service_role', 'public.web_page_analytics', 'INSERT') then
    raise exception 'Service role must retain analytics INSERT';
  end if;
end $$;
set local role anon;
do $$ begin
  begin
    insert into public.web_page_analytics (visit_date, visitor_key, path, duration_seconds)
    values (current_date, 'security-fixture', '/map', 1);
    raise exception 'anon bypassed analytics API';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin
    insert into public.web_page_analytics (visit_date, visitor_key, path, duration_seconds)
    values (current_date, 'security-fixture', '/map', 1);
    raise exception 'authenticated bypassed analytics API';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
insert into public.web_page_analytics (visit_date, visitor_key, path, duration_seconds)
values (current_date, 'security-service-fixture', '/map', 1);
reset role;
rollback;
