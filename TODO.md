# Delivery outcomes

## Listener song request flow
- [x] Public listener request UI and endpoint are temporarily disabled while the persistent backend is not configured.
- [ ] Re-enable the message/request button only after the production queue backend is configured and verified.

## AutoDJ request playback
- [x] AutoDJ reads pending message requests, matches them through the existing YouTube/provider lookup, and queues them in request order.
- [x] Requested songs are played automatically in sequence, without repeating the same song through the existing no-repeat rules.
- [x] A request is removed from durable storage only after its associated track finishes; failed or unmatched requests remain retryable.

## Continuous playback and recovery
- [x] The browser preloads upcoming tracks and automatically retries an active source that stalls or takes too long to load.
- [x] Failed tracks trigger server-side recovery and the player continues with the next queued track rather than stopping the station.
- [x] Existing storage-saving behavior remains intact: the app stores identifiers and request state, not permanent downloaded song copies.

## RJ FM branding and Render storage recovery
- [x] Use the exact user-uploaded RJ FM logo and replace the remaining user-facing MOR station labels with RJ FM; retain the “ABS-CBN Complex · Naga City” location and keep the internal reference-stream sync working.
- [x] Detect an unwritable Render data directory before claiming filesystem persistence; fall back safely when `/var/data` is inaccessible and keep admin settings from reporting false persistence.

## Validation and delivery
- [x] Keep `public/manus-routes.json` synchronized with the page routes.
- [x] Run the existing queue/repeat/filter/schedule tests plus TypeScript/build checks.
- [x] Commit and push the completed change to the imported repository's `main` branch.
