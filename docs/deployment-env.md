# Deployment environment and admin persistence

The admin settings and station queue require a persistent PostgreSQL database. For a Supabase deployment, configure the Supabase **PostgreSQL connection URI** as `POSTGRES_URL` in the production host's encrypted environment-variable settings. The application also accepts `POSTGRES_URL_NON_POOLING`, `DATABASE_URL`, or `SUPABASE_DB_URL`, but `POSTGRES_URL` is the recommended name. A Supabase project URL (`https://…supabase.co`) or an API/service-role key is not a PostgreSQL connection string.

For Vercel, open the app's project settings, add `POSTGRES_URL` for each environment that should save data (Production, Preview, and/or Development), and redeploy so the runtime receives it. Copy the URI from the Supabase project's Database connection-string screen; keep the database password private and never commit it, paste it into chat, or put it in frontend variables such as `NEXT_PUBLIC_*`. If a connection-pooler URI is used, select the Supabase pooler mode that supports the deployed Node `pg` client.

Apply the SQL migrations under `supabase/migrations/` to the same Supabase project before relying on the station. The first migration defines the shared state and listener tables used by settings, the queue, and listener counts. The runtime also creates these tables when it first connects, but applying migrations deliberately is the recommended setup. Verify the production deployment received `POSTGRES_URL`, then open the Admin Panel and confirm the missing-database warning is gone before saving settings.

On the first successful PostgreSQL-backed settings read after this update, the app performs a one-time settings migration that enables shuffled Tagalog-only rotation and no-repeat behavior, including for an existing saved settings record. Subsequent admin changes are preserved; an operator can change those switches later.

The application intentionally does not fall back to process memory for admin settings or queue state. Serverless instances can restart or run concurrently; process-local storage would make successful-looking saves disappear or split station state between instances. Without a configured PostgreSQL URL, admin settings are not durable and the admin endpoint returns an actionable configuration error.

See `.env.example` for variable names and placeholder shapes. The example contains no usable credentials.
