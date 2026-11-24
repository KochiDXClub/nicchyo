begin;

do $$
declare
  vector_text text := array_fill(1::real, array[1536])::public.vector::text;
  query_vector public.vector := vector_text::public.vector;
  fixture_id uuid;
  failed_id uuid;
  expired_id uuid;
  attempt_id uuid;
  retained_versions integer[];
  old_history record;
  live_version integer;
begin
  if has_function_privilege('anon', 'public.begin_embedding_sync(text,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.finish_embedding_sync(uuid,boolean,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.stage_embedding_batch(uuid,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.read_embedding_sync_history()', 'EXECUTE')
     or has_table_privilege('authenticated', 'public.knowledge_embedding_versions', 'SELECT') then
    raise exception 'A client role can read or manage embedding versions';
  end if;

  insert into public.vendors (shop_name, listing_status) values ('Embedding version fixture', 'allowed') returning id into fixture_id;
  select id into attempt_id from public.begin_embedding_sync('vendors', 'scheduled', null);
  perform public.stage_embedding_batch(attempt_id, jsonb_build_array(jsonb_build_object(
    'vendor_id', fixture_id, 'content', 'Vendor fixture', 'embedding', vector_text
  )));
  if exists (select 1 from public.match_vendor_embeddings(query_vector, 1000, 0.7) where vendor_id = fixture_id) then
    raise exception 'A running vendor version is visible';
  end if;
  perform public.finish_embedding_sync(attempt_id, true, 1);
  if not exists (select 1 from public.match_vendor_embeddings(query_vector, 1000, 0.7) where vendor_id = fixture_id) then
    raise exception 'The published vendor version is missing';
  end if;
  update public.vendors set listing_status = 'declined' where id = fixture_id;
  if exists (select 1 from public.match_vendor_embeddings(query_vector, 1000, 0.7) where vendor_id = fixture_id) then
    raise exception 'Revocation did not immediately remove a vendor from retrieval';
  end if;
  delete from public.vendors where id = fixture_id;
  if exists (select 1 from public.vendor_embedding_versions where vendor_id = fixture_id) then
    raise exception 'Deleting a vendor did not remove its snapshots';
  end if;

  select id into failed_id from public.begin_embedding_sync('knowledge', 'script', null);
  perform public.stage_embedding_batch(failed_id, jsonb_build_array(jsonb_build_object(
    'id', 'fixture-failure', 'content', 'This must never be read', 'embedding', vector_text
  )));
  begin
    perform public.finish_embedding_sync(failed_id, true, 2);
    raise exception 'Partial version was published' using errcode = 'P1001';
  exception when raise_exception then
    if sqlerrm not like 'Incomplete embedding version%' then raise; end if;
  end;
  perform public.finish_embedding_sync(failed_id, false, 1);
  if exists (select 1 from public.embedding_versions where id = failed_id)
     or exists (select 1 from public.knowledge_embedding_versions where version_id = failed_id)
     or not exists (select 1 from public.embedding_sync_runs where id = failed_id and status = 'failed' and processed_count = 1) then
    raise exception 'Failed staging or its history is incorrect';
  end if;

  select id into expired_id from public.begin_embedding_sync('knowledge', 'script', null);
  begin
    perform public.begin_embedding_sync('knowledge', 'script', null);
    raise exception 'A second run started for the same target';
  exception when unique_violation then null;
  end;
  perform public.stage_embedding_batch(expired_id, jsonb_build_array(jsonb_build_object(
    'id', 'fixture-interrupted', 'content', 'This must never be read', 'embedding', vector_text
  )));
  update public.embedding_sync_runs set started_at = now() - interval '11 minutes' where id = expired_id;
  if not exists (
    select 1 from public.read_embedding_sync_history() h, jsonb_array_elements(h.runs) r
    where r->>'id' = expired_id::text and r->>'status' = 'interrupted'
  ) then
    raise exception 'Expired attempt is displayed as still running';
  end if;

  for version in 2..7 loop
    select id into attempt_id from public.begin_embedding_sync('knowledge', 'script', null);
    perform public.stage_embedding_batch(attempt_id, jsonb_build_array(jsonb_build_object(
      'id', 'fixture-' || version, 'content', 'Content version ' || version, 'embedding', vector_text
    )));
    if exists (
      select 1 from public.match_knowledge_context(query_vector, 1000, 0.7) where id = 'fixture-' || version
    ) then
      raise exception 'A staging row is visible during build';
    end if;
    select f.version_number into live_version from public.finish_embedding_sync(attempt_id, true, 1) f;
    if live_version <> version then raise exception 'Unexpected version %', live_version; end if;
    if (select count(*) from public.knowledge_embeddings) <> 1
       or not exists (
         select 1 from public.match_knowledge_context(query_vector, 1000, 0.7)
         where id = 'fixture-' || version and content = 'Content version ' || version
       ) then
      raise exception 'The active version contains missing, mixed or stale rows';
    end if;
  end loop;

  if exists (select 1 from public.embedding_versions where id = expired_id)
     or exists (select 1 from public.knowledge_embedding_versions where version_id = expired_id) then
    raise exception 'Interrupted staging was not discarded';
  end if;
  begin
    perform public.stage_embedding_batch(expired_id, '[]');
    raise exception 'A late writer was accepted';
  exception when no_data_found then null;
  end;

  select array_agg(v.version_number order by v.version_number) into retained_versions
  from public.embedding_versions v where v.target = 'knowledge';
  if retained_versions is distinct from array[4,5,6,7]
     or (select count(*) from public.knowledge_embedding_versions) <> 4 then
    raise exception 'Expected exactly the latest four published versions, got %', retained_versions;
  end if;
  select * into old_history from public.embedding_sync_runs where target = 'knowledge' and version_number = 2;
  if not found or old_history.status <> 'succeeded'
     or not exists (select 1 from public.read_embedding_sync_history() h where h.vendors = 2 and h.knowledge = 7) then
    raise exception 'History was pruned or a different target was advanced';
  end if;
end;
$$;

rollback;
