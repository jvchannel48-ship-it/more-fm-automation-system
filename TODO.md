# Delivery outcomes

## Listener song request flow
- [x] Preserve the active public song-request UI and POST `/api/requests` route from the current upstream branch; do not restore stale local code that disabled the endpoint.
- [ ] Verify production queue persistence and end-to-end listener request processing after a fresh deployment.

## AutoDJ request playback
- [x] AutoDJ reads pending message requests, matches them through the existing YouTube/provider lookup, and queues them in request order.
- [x] Requested songs are played automatically in sequence, without repeating the same song through the existing no-repeat rules.
- [x] A request is removed from durable storage only after its associated track finishes; failed or unmatched requests remain retryable.

## Song-request lookup and history controls
- [x] Match a requested song by exact title and artist in no-key YouTube search results even when the uploader/channel label is not recognized as official; retain the existing track filters.
- [x] Do not let general selection history block a song lookup; always block songs in the completed-song ledger for the current Manila day or in the current music queue, even if an old saved no-repeat setting is false.
- [x] Identify a duplicate request as already played or already scheduled; keep unmatched requests pending for retry instead of reporting them as duplicates.
- [x] Remove played-song history displays, playback-history statistics, no-repeat and rotation-history controls, and the “Based on songs successfully added to station history” copy from the Admin Panel; keep the private completed-song ledger for repeat prevention.
- [ ] Live listener request verification remains pending until a fresh deployment is confirmed; the source route is active, and an unmatched request must remain pending for retry.

## Continuous playback and recovery
- [x] The browser preloads upcoming tracks and automatically retries an active source that stalls or takes too long to load.
- [x] Failed tracks trigger server-side recovery and the player continues with the next queued track rather than stopping the station.
- [x] Existing storage-saving behavior remains intact: the app stores identifiers and request state, not permanent downloaded song copies.

## Admin songs playlist
- [x] Admin can search YouTube without an API key, review updated results, and add selected songs to the RJ TOP SONGS or RJ PLAYED playlist.
- [x] Admin can view the saved songs playlist and remove entries without deleting audio files or interrupting the currently playing song.
- [x] Admin playlist search supports one-step Auto add (search + best-match add) so title/artist requests do not require manual re-search.
- [x] Pending song requests expose Auto add: reads title + artist, searches provider, and adds the best match to RJ PLAYED.
- [x] Daily no-repeat ledger remains the gate so the same song is not rotated again for the rest of the day once played.
- [x] AutoDJ searches classic Tagalog/English love songs (60s–90s focus), blocks rock and dance, auto-adds resolved tracks to RJ PLAYED, and auto-removes them from the active playlist after they finish playing.

## RJ FM Makati relay
- [ ] Admin can turn the live 100.3 RJFM Makati relay ON or OFF without exposing or importing its playlist.
- [ ] Admin can configure a Manila-time schedule that automatically switches the relay on within the saved window and returns to the local RJ FM queue outside it.

## Immediate play and balanced transitions
- [x] Pre-create and preload current/upcoming audio before Play; clicking Play starts the prepared source directly when it is ready.
- [x] Warm the incoming track muted throughout the look-ahead window and use a persisted constant-power crossfade so the old track fades down as the next fades up without a midpoint volume dip.
- [x] If the API or source is unavailable, keep startup recovery explicit and retryable instead of reporting a false Live state indefinitely.

## RJ FM branding and Render storage recovery
- [x] Use the exact user-uploaded RJ FM logo and replace the remaining user-facing MOR station labels with RJ FM; retain the “ABS-CBN Complex · Naga City” location and keep the internal reference-stream sync working.
- [x] Detect an unwritable Render data directory before claiming filesystem persistence; fall back safely when `/var/data` is inaccessible and keep admin settings from reporting false persistence.

## Validation and delivery
- [x] Keep `public/manus-routes.json` synchronized with the page routes.
- [x] Run the crossfade, settings/disk, queue/repeat/filter/schedule tests plus TypeScript/build checks.
- [x] Commit and push the completed change to the imported repository's `main` branch.

## Bicol-region RJ FM branding
- [x] Update the RJ FM logo with the exact “NO. 1 BICOL REGION” wording and “RJ FM” name, keeping the supplied gold/teal emblem in a dark-navy-compatible palette.

## Admin listener and shuffle controls
- [x] Add per-tab listener heartbeats and report the current active-listener total; remove stopped tabs and expire stale sessions after 60 seconds.
- [x] Make the listener-cap control save and enforce integers from 0–1,000 (default 2; 0 means unlimited), and show the active total alongside the cap. Postgres advisory locking provides a race-free global cap; JSON-storage fallback warns that simultaneous multi-instance admission is best-effort.
- [x] Make Shuffle an enabled, persistent ON/OFF switch; ON randomizes eligible songs, OFF follows source order, and no-repeat protection remains enforced.
