# Listener accounts and song-request credits (Render Postgres)

The app stores email/password accounts, sessions, private profile pictures, and credit balances in the existing Render Postgres database. Each accepted song request costs 20 credits. Daily credits reset by the Asia/Manila date; bonus credits are added by the admin and do not expire. The app returns the new balance immediately after a request and refreshes visible balances every 3 seconds while the page is open.

## Configure the Render web service (required)

### 1. `DATABASE_URL` (fixes "Render Postgres is not connected")

1. Open **Render Dashboard** → Postgres resource **`mor-naga-db`** (or your current DB).
2. Copy the **Internal Database URL** (not the External one when the web service is on Render).
3. Open the **`more-fm-automation-system`** web service → **Environment**.
4. Add or update:

   | Key | Value |
   |-----|--------|
   | `DATABASE_URL` | *paste Internal Database URL* |

5. Save and **Manual Deploy** / restart the web service.

The app reads `DATABASE_URL` first. It also accepts `POSTGRES_URL`, `POSTGRES_CONNECTION_STRING`, or `RENDER_DATABASE_URL` as fallbacks.

Keep this value **server-only**. Never use a `NEXT_PUBLIC_` prefix and never commit the URL.

### 2. Admin panel password

Admin login fails closed if `ADMIN_PASSWORD` is missing.

| Key | Value |
|-----|--------|
| `ADMIN_PASSWORD` | `09485054936` |
| `ADMIN_SECRET` | *(optional)* separate cookie-signing secret; defaults to `ADMIN_PASSWORD` if unset |

After setting these, log in to the Admin Panel with password **`09485054936`**.

### 3. One-time SQL migration

Run [`db/migrations/202611180001_listener_accounts_credits.sql`](../db/migrations/202611180001_listener_accounts_credits.sql) against that Render database once (Render Shell, `psql`, or any SQL client). It creates only the account/session/credit tables and does not alter station playback data. The application does not auto-run DDL on startup.

### 4. Redeploy

Redeploy/restart the web service after env vars and migration are ready. The daily allowance starts at 0; sign into Admin Panel and set the daily credit amount before song requests can use daily credits.

## Security notes

Email/password authentication is handled by the app; passwords are salted and hashed using Node's scrypt, and raw passwords are never stored. Sessions are opaque random tokens stored by hash in Postgres and sent to the browser only in an HttpOnly, Secure-on-HTTPS, SameSite=Lax cookie. Email changes take effect immediately and currently do not send a verification email because no SMTP/email provider is configured. Profile avatars are private, stored as Postgres bytes, and limited to JPEG/PNG/WebP up to 1 MiB.

## Important Render database lifecycle note

The existing `mor-naga-db` was reported by Render as a **Free** Postgres instance with an expiration date of **December 14, 2026**. It is suitable for connecting this implementation now, but do not rely on it for permanent balances beyond that date without confirming Render's current retention/upgrade options and backing up the data. An expiring database could make account login and credit balances unavailable or lose data.
