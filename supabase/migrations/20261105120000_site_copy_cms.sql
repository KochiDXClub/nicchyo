-- 公開・下書きは単一行にまとめ、版番号で同時編集を検出する。
create table public.site_copy_state (
  id integer primary key default 1 check (id = 1),
  draft jsonb,
  published jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.site_copy_state (id) values (1);
create table public.site_copy_history (
  id bigint generated always as identity primary key,
  content jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null
);
alter table public.site_copy_state enable row level security;
alter table public.site_copy_history enable row level security;
revoke all on public.site_copy_state, public.site_copy_history from public, anon, authenticated;
grant select, insert, update on public.site_copy_state to service_role;
grant select, insert on public.site_copy_history to service_role;
grant usage, select on sequence public.site_copy_history_id_seq to service_role;

create function public.save_site_copy(p_content jsonb, p_expected_revision bigint, p_publish boolean, p_actor uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare current_revision bigint; next_revision bigint;
begin
  select revision into current_revision from public.site_copy_state where id = 1 for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'site_copy_conflict' using errcode = 'P0001';
  end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' or p_actor is null then
    raise exception 'invalid_site_copy' using errcode = '22023';
  end if;
  update public.site_copy_state set draft = p_content,
    published = case when p_publish then p_content else published end,
    revision = revision + 1, updated_at = now(), updated_by = p_actor
    where id = 1 returning revision into next_revision;
  if p_publish then
    insert into public.site_copy_history (content, published_by) values (p_content, p_actor);
  end if;
  return next_revision;
end;
$$;
revoke all on function public.save_site_copy(jsonb, bigint, boolean, uuid) from public, anon, authenticated;
grant execute on function public.save_site_copy(jsonb, bigint, boolean, uuid) to service_role;
