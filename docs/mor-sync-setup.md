# MOR SYNC MODE setup

## Source and behavior

The mode reads the public Zeno SSE metadata endpoint for the MOR Entertainment Manila-labeled listing. The mount identifier is `0ha8ftewqp8uv`, taken from the Zeno profile's `streamName`. The app consumes only the metadata text; it does not rebroadcast MOR audio. The public listing and live metadata response were verified, but they do not by themselves prove MOR account ownership. Non-music labels such as ads, DJ talk, news, jingles, promos, and programs are rejected before track lookup.

When an identifiable song arrives, AutoDJ searches its existing MP3Juice song-discovery provider for an exact title-and-artist match. This repository does not contain a persistent personal music library; the existing uploaded station assets are jingles, commercials, news, and DJ clips. If there is no exact match, MoRe FM queues an OPM track from the current program's Tagalog pool (using the Tagalog love-song pool if that program has no Tagalog entries) and reports `HINDI NAKITA YUNG KANTA`. If MOR metadata is unavailable or describes talk/news/ads, that material is not copied and ordinary AutoDJ continues. Provider search results are external availability, not a guarantee that a particular user's private music library contains the song.

## Unattended server updates

The Vercel schedule in `vercel.json` invokes `/api/cron/mor-sync` once per minute. Add a random, at-least-16-character `CRON_SECRET` environment variable to the Vercel project for Production, then redeploy. Vercel sends it as `Authorization: Bearer <secret>`; the route rejects requests when the secret is missing or incorrect. The MOR switch and sync status are persisted in the app's Supabase/Postgres `public.morefm_state` table and are coordinated with AutoDJ through an atomic database lease. They do not depend on an admin session or the operator's computer.

Configure the app's persistent Postgres connection (`POSTGRES_URL` is preferred; the storage module also accepts its documented URL aliases) and apply `supabase/migrations/20261114000000_morefm_state.sql` before relying on server-side persistence. Do not use process memory as the production state store.

Vercel's current docs limit Hobby schedules to once per day and allow once-per-minute schedules on Pro/Enterprise. This repository's current runtime/hosting account was not visible from the sandbox; confirm deployment is Vercel Pro/Enterprise for minute-level automation. If it is hosted elsewhere, configure that host to call the same protected endpoint every minute and pass the same bearer secret.

## Sources

- [ABS-CBN announcement about MOR's digital platforms](https://corporate.abs-cbn.com/newsroom/news-releases/2021/2/12/abs-cbn-rolls-out-mor-entertainment-via-multiple-d)
- [Official TFC MOR Entertainment channel](https://mytfc.com/channels/mor-entertainment)
- [MOR Entertainment listing on Zeno.FM](https://zeno.fm/radio/mor-entertainment/)
- [Zeno Media Metadata API description](https://help.zeno.fm/en/article/what-is-the-metadata-api-wh2c9s/)
- [Vercel Cron security and management](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs)
- [Vercel Cron usage and plan limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing)
