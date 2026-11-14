create table if not exists public.morefm_state (
  storage_key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.morefm_state enable row level security;

create table if not exists public.morefm_listeners (
  listener_id text primary key,
  last_seen_at timestamptz not null default now()
);

alter table public.morefm_listeners enable row level security;
