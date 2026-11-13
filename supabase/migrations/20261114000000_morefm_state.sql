create table if not exists public.morefm_state (
  storage_key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.morefm_state enable row level security;
