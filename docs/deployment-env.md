# Deployment environment and admin persistence

`POSTGRES_URL` is the recommended production backend for the whole station. The application also accepts `POSTGRES_URL_NON_POOLING`, `DATABASE_URL`, or `SUPABASE_DB_URL`. PostgreSQL stores admin settings, the shared playback queue, listener counts, leases, and related state. Use a Supabase PostgreSQL connection URI—not the project URL or an API key—and apply the SQL migrations under `supabase/migrations/`.

For Vercel, add `POSTGRES_URL` to each required environment (Production, Preview, and/or Development) and redeploy. Copy the URI from the Supabase project's Database connection-string screen; keep its password private, never commit it or paste it into chat, and never expose it through a `NEXT_PUBLIC_*` variable. If using a pooler, select a Supabase mode supported by the deployed Node `pg` client.

## Admin-settings fallback without PostgreSQL

When no PostgreSQL URL is present, admin settings and the one-time settings-migration marker can instead be saved as private JSON objects in a dedicated `more-fm-settings` Supabase Storage bucket. The app creates the bucket if needed and verifies it is private before reading or writing. This fallback requires server-only `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`). The settings object is stored under `app-state/station/settings.json`; do not put a service-role key in browser code or commit it.

This fallback fixes admin-settings persistence only. Queue state, playback leases and listener counts still need PostgreSQL to remain shared and coordinated across serverless instances. Without PostgreSQL, those parts are process-local and can reset or diverge between instances; set up `POSTGRES_URL` before relying on shared station playback. Supabase Storage availability is also required for the settings-only fallback; with neither backend configured, the Admin Panel shows an actionable warning and saving is rejected instead of pretending the change persisted.

The first persistent settings read fills any missing Tagalog-only, shuffle, and no-repeat preferences with their ON defaults while preserving every explicitly saved operator choice. Sunday programming is always a separate full-day Tagalog senior-classics rotation and does not add English songs, jingles, commercials, news, or DJ-mic clips between tracks. Subsequent manual admin changes remain saved.

See `.env.example` for variable names and placeholder shapes. It contains no usable credentials.
