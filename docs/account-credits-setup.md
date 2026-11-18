# Listener accounts and song-request credits (Render Postgres)

The app stores email/password accounts, sessions, private profile pictures, and credit balances in the existing Render Postgres database. Each accepted song request costs 20 credits. Daily credits reset by the Asia/Manila date; bonus credits are added by the admin and do not expire. The app returns the new balance immediately after a request and refreshes visible balances every 3 seconds while the page is open.

## Configure the Render service

1. In Render, open the `more-fm-automation-system` web service and add `DATABASE_URL` using the **Internal Database URL** from the existing `mor-naga-db` Postgres resource in the same region/workspace. Keep this value server-only; never use a `NEXT_PUBLIC_` prefix or commit the URL.
2. Run [`db/migrations/202611180001_listener_accounts_credits.sql`](../db/migrations/202611180001_listener_accounts_credits.sql) against that Render database once. It creates only the account/session/credit tables and does not alter station playback data. The application does not auto-run DDL on startup.
3. Make sure `ADMIN_PASSWORD` is set on the web service; Admin login intentionally fails closed if it is missing. Optionally set `ADMIN_SECRET` as a separate cookie-signing secret.
4. Redeploy/restart the web service after the env var and migration are ready. The daily allowance starts at 0; sign into Admin Panel and set the daily credit amount before song requests can use daily credits.

Email/password authentication is handled by the app; passwords are salted and hashed using Node's scrypt, and raw passwords are never stored. Sessions are opaque random tokens stored by hash in Postgres and sent to the browser only in an HttpOnly, Secure-on-HTTPS, SameSite=Lax cookie. Email changes take effect immediately and currently do not send a verification email because no SMTP/email provider is configured. Profile avatars are private, stored as Postgres bytes, and limited to JPEG/PNG/WebP up to 1 MiB.

## Important Render database lifecycle note

The existing `mor-naga-db` was reported by Render as a **Free** Postgres instance with an expiration date of **December 14, 2026**. It is suitable for connecting this implementation now, but do not rely on it for permanent balances beyond that date without confirming Render's current retention/upgrade options and backing up the data. An expiring database could make account login and credit balances unavailable or lose data.
