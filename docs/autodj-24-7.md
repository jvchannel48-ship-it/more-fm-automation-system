# RJ FM 24/7 AutoDJ keeper

The web app keeps three future music tracks queued for each independent RJ FM station. The background keeper calls the authenticated AutoDJ heartbeat so queues continue to be refreshed even when no listener has the player page open.

## Deploy the background worker on Render

Create a **Background Worker** from this same GitHub repository and branch/commit after the AutoDJ changes are merged.

- Runtime: Node
- Build command: `corepack enable && pnpm install --frozen-lockfile`
- Start command: `pnpm run autodj:keeper`
- Set `AUTODJ_BASE_URL` to the public base URL of the RJ FM web service (no trailing slash).
- Set `AUTODJ_CRON_SECRET` to a long random secret.

Also set the exact same `AUTODJ_CRON_SECRET` value in the RJ FM **Web Service** environment, then redeploy both services. Do not expose this secret in browser code.

The worker rotates through Manila, Naga, Cebu, General Santos, Cagayan de Oro, Davao, Iloilo and Masbate, requesting a fresh queue every cycle. If the music search/download provider is unavailable, it logs the failure and retries on the next cycle.

## Operational notes

- The background worker must remain running on an always-on worker instance; a sleeping/free web service or a missing worker cannot guarantee 24/7 playback.
- Keep durable Supabase or Vercel Blob storage configured so queue state and song history survive restarts.
- Search only accepts original-artist tracks and keeps RJ FM's blocked genres / AI-cover restrictions.
- RJ FM avoids tracks in the recent 30-day play history. If the external catalogue has no eligible new track or the provider is offline, AutoDJ retries instead of inventing audio or bypassing the music restrictions.
