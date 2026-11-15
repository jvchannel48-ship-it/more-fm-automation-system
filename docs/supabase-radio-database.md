# MORE FM Supabase radio database

This app uses Supabase PostgreSQL directly from the server. The radio tables do not use the browser or a YouTube API key. Keep `POSTGRES_URL` private; set it as a server secret in Render (or the host running MORE FM), never as a `NEXT_PUBLIC_*` variable and never in Git.

## Set up a Supabase Free project

1. Create a Supabase project and select the Free plan. This repository does not provision or bill a project for you.
2. In Supabase, open the SQL Editor and run [`supabase/migrations/20261115000000_morefm_radio_catalog.sql`](../supabase/migrations/20261115000000_morefm_radio_catalog.sql). The app can create missing tables on first database connection too, but the migration is the source of truth for the schema.
3. Copy the project's PostgreSQL connection URI from the Supabase Database connection settings. Set it as the Render secret `POSTGRES_URL`; use the PostgreSQL connection URI, not the Supabase project URL, anon key, or service-role key.
4. From the repository, with `POSTGRES_URL` set in your secure shell environment, run `pnpm db:seed`. This imports the bundled RJ TOP SONGS and RJ PLAYED catalog into `public.songs`; it is safe to run again because it upserts by `youtube_id`.
5. Redeploy MORE FM. When the database contains active songs, AutoDJ reads them in playlist order and keeps its existing no-repeat protection. If the database is not configured or has no active songs, the bundled playlist remains the fallback.

Supabase's Free plan has provider-defined quotas and limits that can change. The app uses ordinary PostgreSQL tables and does not enable paid add-ons, but you are responsible for monitoring the project's usage and staying within the Free plan's current limits.

## Tables

- `songs`: `title`, `artist`, `youtube_id`, `category`, and `picture`, plus `language`, `decade`, duration, active status, playlist group, and ordering fields. Allowed categories are `60s`, `70s`, `80s`, `90s`, `20s`, `tagalog`, and `english`. A decade is kept in `category` when known and the separate `language` field can still label the same song as Tagalog or English. The `20s` bucket covers the catalog's 2000s and 2020s tracks.
- `requests`: `name`, `song_title`, optional `artist`, status, and timestamp. The public song-request form stores the listener's name here; admin actions update the request status.
- `top_played`: one row per YouTube video with the song ID (when it is in `songs`), title, artist, play count, and last-played time. AutoDJ increments it when a music track completes.

All three tables have row-level security enabled and no browser policies. MORE FM uses its server-only PostgreSQL connection for reads and writes. Do not expose database credentials in client code.

## YouTube search and thumbnails

The existing `youtube-sr` public search path is used for song lookup and song requests without a YouTube API key. It is not an official YouTube Data API integration. The seed script uses YouTube video IDs already in the bundled catalog and creates standard thumbnail URLs for `picture`; it makes no API-key call.
