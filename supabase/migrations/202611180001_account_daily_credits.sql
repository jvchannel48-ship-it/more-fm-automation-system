-- RJ FM account and daily-credit schema for Supabase Postgres.
-- Apply once in the Supabase SQL Editor. All credit mutations are transactional RPCs.
create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listener-avatars', 'listener-avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.station_credit_settings (
  id boolean primary key default true check (id),
  daily_allowance integer not null default 0 check (daily_allowance >= 0 and daily_allowance <= 1000000),
  updated_at timestamptz not null default now()
);
insert into public.station_credit_settings (id, daily_allowance)
values (true, 0) on conflict (id) do nothing;

create table if not exists public.listener_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  daily_credits integer not null default 0 check (daily_credits >= 0),
  bonus_credits integer not null default 0 check (bonus_credits >= 0),
  credit_date date not null default (timezone('Asia/Manila', now()))::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.station_credit_settings enable row level security;
alter table public.listener_profiles enable row level security;
revoke all on public.station_credit_settings from anon, authenticated;
revoke all on public.listener_profiles from anon, authenticated;
grant all on public.station_credit_settings to service_role;
grant all on public.listener_profiles to service_role;

create or replace function public.initialize_listener_profile()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare daily_amount integer;
begin
  select daily_allowance into daily_amount from public.station_credit_settings where id = true;
  insert into public.listener_profiles(user_id, display_name, daily_credits, credit_date)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email, '@', 1)), coalesce(daily_amount,0), (timezone('Asia/Manila', now()))::date)
  on conflict(user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_listener_profile on auth.users;
create trigger on_auth_user_created_listener_profile after insert on auth.users
for each row execute function public.initialize_listener_profile();

create or replace function public.listener_credit_state(p_user_id uuid)
returns table(daily_credits integer, bonus_credits integer, daily_allowance integer, credits_remaining integer, credit_date date)
language plpgsql security definer set search_path = public, pg_temp as $$
declare today date := (timezone('Asia/Manila', now()))::date; allowance integer;
begin
  select s.daily_allowance into allowance from public.station_credit_settings s where s.id = true;
  allowance := coalesce(allowance,0);
  insert into public.listener_profiles(user_id, display_name, daily_credits, credit_date)
  select p_user_id, coalesce(nullif(u.raw_user_meta_data->>'display_name',''), split_part(u.email,'@',1)), allowance, today
  from auth.users u where u.id = p_user_id on conflict(user_id) do nothing;
  update public.listener_profiles p set daily_credits = allowance, credit_date = today, updated_at = now()
  where p.user_id = p_user_id and p.credit_date < today;
  return query select p.daily_credits, p.bonus_credits, allowance, p.daily_credits + p.bonus_credits, p.credit_date
  from public.listener_profiles p where p.user_id = p_user_id;
end;
$$;

create or replace function public.charge_song_request(p_user_id uuid)
returns table(accepted boolean, daily_credits integer, bonus_credits integer, credits_remaining integer, daily_allowance integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare today date := (timezone('Asia/Manila', now()))::date; allowance integer; d integer; b integer;
begin
  select s.daily_allowance into allowance from public.station_credit_settings s where s.id = true;
  allowance := coalesce(allowance,0);
  insert into public.listener_profiles(user_id, daily_credits, credit_date)
  values (p_user_id, allowance, today) on conflict(user_id) do nothing;
  perform 1 from public.listener_profiles p where p.user_id = p_user_id for update;
  update public.listener_profiles p set daily_credits = allowance, credit_date = today, updated_at = now()
  where p.user_id = p_user_id and p.credit_date < today;
  select p.daily_credits, p.bonus_credits into d, b from public.listener_profiles p where p.user_id = p_user_id;
  if coalesce(d,0) + coalesce(b,0) < 20 then
    return query select false, coalesce(d,0), coalesce(b,0), coalesce(d,0)+coalesce(b,0), allowance;
    return;
  end if;
  if d >= 20 then d := d - 20;
  else b := b - (20 - d); d := 0;
  end if;
  update public.listener_profiles p set daily_credits = d, bonus_credits = b, updated_at = now() where p.user_id = p_user_id;
  return query select true, d, b, d+b, allowance;
end;
$$;

create or replace function public.set_daily_credit_allowance(p_amount integer)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_amount < 0 or p_amount > 1000000 then raise exception 'Daily credit amount must be between 0 and 1,000,000'; end if;
  update public.station_credit_settings set daily_allowance = p_amount, updated_at = now() where id = true;
  return p_amount;
end;
$$;

create or replace function public.add_credit_all(p_amount integer)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare affected integer;
begin
  if p_amount < 1 or p_amount > 1000000 then raise exception 'Credit grant must be between 1 and 1,000,000'; end if;
  update public.listener_profiles set bonus_credits = bonus_credits + p_amount, updated_at = now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.refund_song_request(p_user_id uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare remaining integer;
begin
  update public.listener_profiles set bonus_credits = bonus_credits + 20, updated_at = now()
  where user_id = p_user_id returning daily_credits + bonus_credits into remaining;
  return coalesce(remaining, 0);
end;
$$;

-- Service-role-only RPCs. The app verifies the end user's Supabase token first,
-- then invokes these functions with the authenticated user's ID.
revoke all on function public.listener_credit_state(uuid) from public, anon, authenticated;
revoke all on function public.charge_song_request(uuid) from public, anon, authenticated;
revoke all on function public.set_daily_credit_allowance(integer) from public, anon, authenticated;
revoke all on function public.add_credit_all(integer) from public, anon, authenticated;
revoke all on function public.refund_song_request(uuid) from public, anon, authenticated;
grant execute on function public.listener_credit_state(uuid) to service_role;
grant execute on function public.charge_song_request(uuid) to service_role;
grant execute on function public.set_daily_credit_allowance(integer) to service_role;
grant execute on function public.add_credit_all(integer) to service_role;
grant execute on function public.refund_song_request(uuid) to service_role;
