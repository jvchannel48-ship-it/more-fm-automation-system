# RJ FM durable station storage (Supabase + optional Vercel Blob)

The app stores station settings (including the Broadcast switch), AutoDJ state, and active-listener heartbeat data as private JSON objects. **Primary backend is Supabase Storage.** Vercel Blob remains a fallback when Supabase is not configured.

## Supabase (active)

Configured project:

| Setting | Value |
|---------|--------|
| Project URL | `https://lbzsosywniqvdroimbwd.supabase.co` |
| Publishable key | set via `SUPABASE_PUBLISHABLE_KEY` / defaults in code |
| Bucket | `morefm-station` |

### One-time setup in Supabase Dashboard

1. Open **Storage** → **New bucket**.
2. Name: **`morefm-station`**
3. Make it **Public** *or* add policies that allow the publishable key to `SELECT`, `INSERT`, `UPDATE` on this bucket (required for server writes with the publishable key).
4. Optional (recommended for production): create a **service role** key and set `SUPABASE_SERVICE_ROLE_KEY` on Render instead of relying on the publishable key.

### Render environment (optional overrides)

| Key | Purpose |
|-----|---------|
| `SUPABASE_URL` | Project URL (defaults to the URL above) |
| `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` | Client/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Prefer this server-side for private buckets |
| `SUPABASE_STORAGE_BUCKET` | Defaults to `morefm-station` |

Redeploy after changing env vars.

## Vercel Blob (optional fallback)

If no Supabase credentials are present, the app uses `BLOB_READ_WRITE_TOKEN` / OIDC + `BLOB_STORE_ID` when available.

## Behavior without durable storage

Without working credentials, settings and listener counts continue in process memory so the station remains usable, but they are temporary and may differ between server instances. The Admin Panel warns about this state.

## Listener counter behavior

While playback is active, each browser sends a heartbeat every 30 seconds. A listener is removed when playback stops and otherwise expires after 60 seconds without a heartbeat. JSON saves preserve the count across a normal redeploy, but simultaneous writes from multiple server instances are not atomic.
