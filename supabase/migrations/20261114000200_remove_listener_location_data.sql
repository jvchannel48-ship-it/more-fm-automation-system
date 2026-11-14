-- Stop retaining approximate listener locations and remove any previously stored values.
alter table public.morefm_listeners
  drop column if exists country_code,
  drop column if exists region,
  drop column if exists city;
