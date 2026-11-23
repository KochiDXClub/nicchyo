create table public.map_people_illustrations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  market_id uuid not null references public.markets(id) on delete restrict,
  image_url text not null check (char_length(image_url) between 1 and 500),
  latitude double precision not null check (latitude between 33.4 and 33.7),
  longitude double precision not null check (longitude between 133.4 and 133.7),
  width_px integer not null check (width_px between 16 and 200),
  enabled boolean not null default true
);

create index map_people_illustrations_market_id_idx on public.map_people_illustrations (market_id);
alter table public.map_people_illustrations enable row level security;
revoke all on public.map_people_illustrations from public, anon, authenticated;
grant select, insert, update, delete on public.map_people_illustrations to service_role;

insert into public.map_people_illustrations (id, name, market_id, image_url, latitude, longitude, width_px)
values (
  '45d82c88-155d-40de-8f9e-082928be07d9',
  '買い物袋を持つ来訪者',
  public.default_market_id(),
  '/images/maps/elements/people/sunday-shoppers.webp',
  33.56197, 133.54182, 92
);
