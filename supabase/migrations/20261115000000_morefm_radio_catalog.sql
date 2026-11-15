create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  youtube_id text not null unique,
  category text not null check (category in ('60s', '70s', '80s', '90s', '20s', 'tagalog', 'english')),
  language text check (language is null or language in ('Tagalog', 'English')),
  decade text check (decade is null or decade in ('60s', '70s', '80s', '90s', '20s')),
  picture text,
  duration_seconds integer not null check (duration_seconds between 60 and 540),
  playlist_group text not null default 'RJ TOP SONGS' check (playlist_group in ('RJ TOP SONGS', 'RJ PLAYED')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists songs_active_playlist_idx
  on public.songs (is_active, playlist_group, sort_order);
create index if not exists songs_category_idx on public.songs (category);
create index if not exists songs_language_idx on public.songs (language);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Listener',
  song_title text not null,
  artist text,
  status text not null default 'pending' check (status in ('pending', 'played', 'skipped')),
  created_at timestamptz not null default now()
);

create index if not exists requests_status_created_idx
  on public.requests (status, created_at desc);

create table if not exists public.top_played (
  id uuid primary key default gen_random_uuid(),
  song_id uuid references public.songs(id) on delete set null,
  youtube_id text not null unique,
  title text not null,
  artist text not null,
  play_count bigint not null default 0 check (play_count >= 0),
  last_played_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists top_played_rank_idx
  on public.top_played (play_count desc, last_played_at desc);

-- Browser clients cannot read/write these tables directly. The radio uses its
-- server-only Supabase PostgreSQL connection string for all database access.
alter table public.songs enable row level security;
alter table public.requests enable row level security;
alter table public.top_played enable row level security;
