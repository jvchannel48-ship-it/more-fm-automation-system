# Listener accounts and song-request credits

The application uses Supabase Auth for email/password listener accounts and Supabase Postgres for durable credit balances. Song requests cost 20 credits. Daily credits reset on the Asia/Manila calendar day; admin changes to the daily allowance apply on the next reset. Bonus credits issued by **Add Credit All** do not expire and are consumed after daily credits.

## Supabase setup

1. In the Supabase project SQL Editor, run [`supabase/migrations/202611180001_account_daily_credits.sql`](../supabase/migrations/202611180001_account_daily_credits.sql) once.
2. In Supabase Authentication → Providers, enable Email/password sign-in. If email confirmation is enabled, configure email delivery and use the confirmation link before logging in. Email changes may also require confirmation.
3. In the Vercel project environment settings, add these variables for every environment where the app will run:
   - `NEXT_PUBLIC_SUPABASE_URL`: the project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the publishable/anon key (safe to expose to browser).
   - `SUPABASE_SERVICE_ROLE_KEY`: server-only service-role key. Never add `NEXT_PUBLIC_` and never commit its value.
   - `ADMIN_PASSWORD`: a strong, private admin password. Admin endpoints fail closed when it is missing. Optionally use `ADMIN_SECRET` as a separate signing secret.
4. Redeploy the application after setting environment variables.
5. Log in to the radio Admin Panel, set **Daily credits per user**, and use **Add bonus credits to all accounts** when needed.

The daily allowance is initially zero, so song requests remain unavailable until the admin sets an allowance or grants bonus credits. The account modal shows a user's own balance; the admin account list shows registered users' email, daily credits, and bonus credits.

The `listener-avatars` bucket is public for image display. Uploads are accepted only through the server endpoint after the signed-in user is verified, restricted to JPEG/PNG/WebP, and limited to 2 MiB. Public bucket images can be viewed by anyone who has the URL; do not upload sensitive images.
