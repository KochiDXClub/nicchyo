begin;

insert into public.market_days (market_id, market_date, status, note)
select id, date '2099-01-08', 'cancelled', 'visibility-test-thursday'
from public.markets where slug = 'mokuyo';

insert into public.market_events (market_id, event_date, title, is_published)
select id, date '2099-01-08', fixture.title, fixture.published
from public.markets cross join (values ('visibility-test-public-event', true), ('visibility-test-draft', false)) fixture(title, published)
where slug = 'mokuyo';

update public.markets set is_public = false where slug = 'mokuyo';

set local role anon;
do $$ begin
  if exists (select 1 from public.market_days where note = 'visibility-test-thursday')
    or exists (select 1 from public.market_events where title = 'visibility-test-public-event') then
    raise exception 'anonymous visitors can read calendar rows for a private market';
  end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"general_user"}}', true);
do $$ begin
  if exists (select 1 from public.market_days where note = 'visibility-test-thursday')
    or exists (select 1 from public.market_events where title = 'visibility-test-public-event') then
    raise exception 'members can read calendar rows for a private market';
  end if;
end $$;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin"}}', true);
do $$ begin
  if not exists (select 1 from public.market_days where note = 'visibility-test-thursday')
    or not exists (select 1 from public.market_events where title = 'visibility-test-draft') then
    raise exception 'administrators cannot preview the private calendar';
  end if;
end $$;
reset role;

update public.markets set is_public = true where slug = 'mokuyo';
set local role anon;
select set_config('request.jwt.claims', '{}', true);
do $$ begin
  if not exists (select 1 from public.market_days where note = 'visibility-test-thursday')
    or not exists (select 1 from public.market_events where title = 'visibility-test-public-event')
    or exists (select 1 from public.market_events where title = 'visibility-test-draft') then
    raise exception 'public market visibility or event publication is wrong';
  end if;
end $$;
reset role;
rollback;
