-- Promote complete batches atomically. Keep the existing relation names as
-- read-only views so already deployed search callers keep working.
create table public.embedding_versions (
  id uuid primary key default gen_random_uuid(),
  target text not null check (target in ('vendors', 'knowledge')),
  version_number integer check (version_number > 0),
  active boolean not null default false check (not active or version_number is not null),
  unique (target, version_number)
);

create unique index embedding_versions_active_per_target
  on public.embedding_versions (target) where active;

alter table public.embedding_versions enable row level security;
revoke all on public.embedding_versions from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.embedding_versions to service_role;

insert into public.embedding_versions (target, version_number, active)
values ('vendors', 1, true), ('knowledge', 1, true);

alter table public.vendor_embeddings rename to vendor_embedding_versions;
alter table public.knowledge_embeddings rename to knowledge_embedding_versions;

alter table public.vendor_embedding_versions add column version_id uuid references public.embedding_versions (id) on delete cascade;
alter table public.knowledge_embedding_versions add column version_id uuid references public.embedding_versions (id) on delete cascade;

update public.vendor_embedding_versions
set version_id = (select id from public.embedding_versions where target = 'vendors');
update public.knowledge_embedding_versions
set version_id = (select id from public.embedding_versions where target = 'knowledge');

alter table public.vendor_embedding_versions
  drop constraint vendor_embeddings_pkey,
  alter column version_id set not null,
  add primary key (version_id, vendor_id);
alter table public.knowledge_embedding_versions
  drop constraint knowledge_embeddings_pkey,
  alter column version_id set not null,
  add primary key (version_id, id);

-- A version has a few hundred rows. Exact search within it avoids the recall
-- loss of filtering a shared approximate index after it has selected candidates.
drop index if exists public.idx_vendor_embeddings_embedding;
drop index if exists public.knowledge_embeddings_embedding_idx;
-- The previous primary key also covered the vendor foreign key's cascade.
create index vendor_embedding_versions_vendor_id on public.vendor_embedding_versions (vendor_id);

revoke all on public.vendor_embedding_versions, public.knowledge_embedding_versions from public, anon, authenticated, service_role;
grant select, insert, update on public.vendor_embedding_versions, public.knowledge_embedding_versions to service_role;

create view public.vendor_embeddings with (security_invoker = true) as
select e.vendor_id, e.store_number, e.shop_name, e.content, e.embedding, e.updated_at
from public.vendor_embedding_versions e
join public.embedding_versions v on v.id = e.version_id and v.target = 'vendors' and v.active
join public.vendors s on s.id = e.vendor_id and s.listing_status = 'allowed';

create view public.knowledge_embeddings with (security_invoker = true) as
select e.id, e.category, e.title, e.content, e.image_url, e.embedding
from public.knowledge_embedding_versions e
join public.embedding_versions v on v.id = e.version_id and v.target = 'knowledge' and v.active;

revoke all on public.vendor_embeddings, public.knowledge_embeddings from public, anon, authenticated, service_role;
grant select on public.vendor_embeddings, public.knowledge_embeddings to service_role;

create or replace function public.match_vendor_embeddings(query_embedding public.vector, match_count integer, match_threshold double precision)
returns table (vendor_id uuid, similarity double precision)
language sql stable set search_path = ''
as $$
  select e.vendor_id, 1 - (e.embedding operator(public.<=>) query_embedding)
  from public.vendor_embeddings e
  where 1 - (e.embedding operator(public.<=>) query_embedding) > match_threshold
  order by e.embedding operator(public.<=>) query_embedding, e.vendor_id
  limit match_count;
$$;

create function public.match_knowledge_context(query_embedding public.vector, match_count integer, match_threshold double precision)
returns table (id text, category text, title text, content text, image_url text, similarity double precision)
language sql stable set search_path = ''
as $$
  select e.id, e.category, e.title, e.content, e.image_url, 1 - (e.embedding operator(public.<=>) query_embedding) as similarity
  from public.knowledge_embeddings e
  where 1 - (e.embedding operator(public.<=>) query_embedding) > match_threshold
  order by similarity desc, e.id
  limit match_count;
$$;

create or replace function public.match_knowledge_embeddings(query_embedding public.vector, match_count integer, match_threshold double precision)
returns table (id text, similarity double precision)
language sql stable set search_path = ''
as $$
  select k.id, k.similarity
  from public.match_knowledge_context(query_embedding, match_count, match_threshold) k
  order by k.similarity desc, k.id;
$$;

revoke all on function
  public.match_vendor_embeddings(public.vector, integer, double precision),
  public.match_knowledge_embeddings(public.vector, integer, double precision),
  public.match_knowledge_context(public.vector, integer, double precision)
from public, anon, authenticated, service_role;
grant execute on function
  public.match_vendor_embeddings(public.vector, integer, double precision),
  public.match_knowledge_embeddings(public.vector, integer, double precision),
  public.match_knowledge_context(public.vector, integer, double precision)
to service_role;

alter table public.embedding_sync_runs
  add column version_number integer check (version_number is null or (version_number > 0 and status = 'succeeded'));

create function public.begin_embedding_sync(p_target text, p_source text, p_actor_id uuid)
returns table (id uuid, started_at timestamptz)
language plpgsql set search_path = ''
as $$
declare
  run public.embedding_sync_runs;
begin
  with expired as (
    update public.embedding_sync_runs r
    set status = 'interrupted', finished_at = clock_timestamp()
    where r.target = p_target and r.status = 'running'
      and r.started_at < clock_timestamp() - interval '10 minutes'
    returning r.id
  )
  delete from public.embedding_versions v
  using expired
  where v.id = expired.id and v.version_number is null;

  insert into public.embedding_sync_runs (target, source, actor_id)
  values (p_target, p_source, p_actor_id) returning * into run;
  insert into public.embedding_versions (id, target) values (run.id, p_target);
  return query select run.id, run.started_at;
end;
$$;

create function public.stage_embedding_batch(p_run_id uuid, p_rows jsonb)
returns void
language plpgsql set search_path = ''
as $$
declare
  run_target text;
begin
  select r.target into strict run_target from public.embedding_sync_runs r
  where r.id = p_run_id and r.status = 'running'
    and r.started_at >= clock_timestamp() - interval '10 minutes' for update;
  if run_target = 'vendors' then
    insert into public.vendor_embedding_versions (version_id, vendor_id, store_number, shop_name, content, embedding)
    select p_run_id, e.vendor_id, e.store_number, e.shop_name, e.content, e.embedding::public.vector(1536)
    from jsonb_to_recordset(p_rows) as e(vendor_id uuid, store_number integer, shop_name text, content text, embedding text)
    on conflict (version_id, vendor_id) do update set
      store_number = excluded.store_number, shop_name = excluded.shop_name, content = excluded.content,
      embedding = excluded.embedding, updated_at = clock_timestamp();
  else
    insert into public.knowledge_embedding_versions (version_id, id, category, title, content, image_url, embedding)
    select p_run_id, e.id, e.category, e.title, e.content, e.image_url, e.embedding::public.vector(1536)
    from jsonb_to_recordset(p_rows) as e(id text, category text, title text, content text, image_url text, embedding text)
    on conflict (version_id, id) do update set
      category = excluded.category, title = excluded.title, content = excluded.content, image_url = excluded.image_url,
      embedding = excluded.embedding;
  end if;
end;
$$;

create function public.finish_embedding_sync(p_run_id uuid, p_succeeded boolean, p_processed_count integer)
returns table (finished_at timestamptz, version_number integer)
language plpgsql set search_path = ''
as $$
declare
  run public.embedding_sync_runs;
  staged_count integer;
  next_version integer;
begin
  select * into strict run from public.embedding_sync_runs r
  where r.id = p_run_id and r.status = 'running' for update;

  if p_succeeded then
    if run.started_at < clock_timestamp() - interval '10 minutes' then
      raise exception 'Embedding run expired (%)', run.id;
    end if;
    if run.target = 'vendors' then
      select count(*) into staged_count from public.vendor_embedding_versions e where e.version_id = run.id;
    else
      select count(*) into staged_count from public.knowledge_embedding_versions e
      where e.version_id = run.id
      having count(*) = count(e.embedding);
    end if;

    if staged_count is distinct from p_processed_count or (run.target = 'knowledge' and staged_count = 0) then
      raise exception 'Incomplete embedding version (%)', run.id;
    end if;

    select v.version_number + 1 into strict next_version from public.embedding_versions v
    where v.target = run.target and v.active for update;
    update public.embedding_versions v set active = false where v.target = run.target and v.active;
    update public.embedding_versions v set active = true, version_number = next_version
    where v.id = run.id and v.target = run.target and v.version_number is null;
    if not found then
      raise exception 'Missing staged embedding version (%)', run.id;
    end if;

    delete from public.embedding_versions v
    where v.target = run.target and v.version_number <= next_version - 4;
  else
    delete from public.embedding_versions v where v.id = run.id and v.version_number is null;
  end if;

  return query
    update public.embedding_sync_runs r
    set status = case when p_succeeded then 'succeeded' else 'failed' end,
        processed_count = p_processed_count, version_number = next_version, finished_at = clock_timestamp()
    where r.id = run.id
    returning r.finished_at, r.version_number;
end;
$$;

create function public.read_embedding_sync_history()
returns table (runs jsonb, vendors integer, knowledge integer)
language sql stable set search_path = ''
as $$
  select
    (select coalesce(jsonb_agg(to_jsonb(r) order by r.started_at desc, r.id desc), '[]'::jsonb)
     from (
       select sr.id, sr.target, sr.source,
         case when sr.status = 'running' and sr.started_at < now() - interval '10 minutes'
           then 'interrupted' else sr.status end as status,
         sr.started_at, sr.finished_at, sr.processed_count, sr.version_number
       from public.embedding_sync_runs sr
       order by sr.started_at desc, sr.id desc
       limit 30
     ) r),
    (select v.version_number from public.embedding_versions v where v.target = 'vendors' and v.active),
    (select v.version_number from public.embedding_versions v where v.target = 'knowledge' and v.active);
$$;

revoke all on function
  public.begin_embedding_sync(text, text, uuid), public.stage_embedding_batch(uuid, jsonb),
  public.finish_embedding_sync(uuid, boolean, integer), public.read_embedding_sync_history()
from public, anon, authenticated, service_role;
grant execute on function
  public.begin_embedding_sync(text, text, uuid), public.stage_embedding_batch(uuid, jsonb),
  public.finish_embedding_sync(uuid, boolean, integer), public.read_embedding_sync_history()
to service_role;
