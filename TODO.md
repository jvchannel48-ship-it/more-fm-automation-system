# Delivery outcomes

## Listener song request flow
- [x] Add a message/request button at the bottom of the public player.
- [x] Opening the button shows fields for song title and artist.
- [x] Submitting validates both fields, shows progress while searching and inserting, and returns a clear successful or waiting state.
- [x] A valid request is persisted and either inserted into the AutoDJ playlist immediately or remains pending for the next queue fill instead of being lost.

## AutoDJ request playback
- [x] AutoDJ reads pending message requests, matches them through the existing YouTube/provider lookup, and queues them in request order.
- [x] Requested songs are played automatically in sequence, without repeating the same song through the existing no-repeat rules.
- [x] A request is removed from durable storage only after its associated track finishes; failed or unmatched requests remain retryable.

## Continuous playback and recovery
- [x] The browser preloads upcoming tracks and automatically retries an active source that stalls or takes too long to load.
- [x] Failed tracks trigger server-side recovery and the player continues with the next queued track rather than stopping the station.
- [x] Existing storage-saving behavior remains intact: the app stores identifiers and request state, not permanent downloaded song copies.

## Validation and delivery
- [x] Keep `public/manus-routes.json` synchronized with the page routes.
- [x] Run the existing queue/repeat/filter/schedule tests plus TypeScript/build checks.
- [ ] Commit and push the completed change to the imported repository's `main` branch.
