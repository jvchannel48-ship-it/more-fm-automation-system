-- Approximate location only; sourced from trusted hosting headers.
-- No raw IP addresses or precise GPS coordinates are stored.
alter table public.morefm_listeners
  add column if not exists country_code text,
  add column if not exists region text,
  add column if not exists city text;
