# Cloudflare deployment

This project is configured for **Cloudflare Workers with the OpenNext adapter**. It is not a static Cloudflare Pages export: the app has Next.js route handlers, admin cookies, server-side audio proxying, and persistence logic that must run in a Worker.

## Deploy from the repository

1. Install dependencies with `pnpm install`.
2. Authenticate Wrangler with `pnpm wrangler login`.
3. Set the Worker secrets with Wrangler. At minimum, configure `ADMIN_PASSWORD`, `ADMIN_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET`. Add `POSTGRES_URL` only when the selected Cloudflare database connectivity is supported by the deployment.
4. Preview the Worker runtime locally with `pnpm preview`.
5. For a Cloudflare Git integration, set the **Build command** to `pnpm run build:cloudflare` and the **Deploy command** to `npx wrangler deploy`. The ordinary `pnpm run build` intentionally remains `next build`; OpenNext calls that script internally, so using OpenNext as the `build` script causes recursive builds.
6. For local CLI deployment, use `pnpm deploy`.

The Worker name and OpenNext asset paths are in `wrangler.jsonc`. The generated `.open-next` directory and `.wrangler` state are intentionally ignored by Git.

## Persistence note

The app prefers PostgreSQL through the `pg` package. Cloudflare Workers do not provide Node's normal long-lived TCP environment, so a direct Supabase PostgreSQL connection string should not be assumed to work in Workers. For a Cloudflare deployment, use the app's private Supabase Storage fallback by setting `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, or add a Cloudflare-supported database connectivity layer before setting `POSTGRES_URL`.

The Supabase service-role key is server-only. Do not expose it as a `NEXT_PUBLIC_*` variable and do not commit it to the repository.

## Pages and Workers

Cloudflare Pages is suitable for a static export, but this application is not static because it uses `/api/*` route handlers and server-side persistence. Deploy it as a Worker using the included OpenNext configuration. A Pages project can still be used as a frontend-only site only after removing or separately hosting all server routes, which is outside this configuration.
