# Implementation plan: DZMM window and continuous playback

## Scope and approach

Continue from the existing `e198e57` project state; do not reset the branch or redesign the station. In Manila time, make the existing DZMM live window active on Monday–Saturday from 2:00 PM through 3:00 PM, with the station back on RJ FM music by 3:01 PM. Keep Sunday on its existing music-only schedule. Keep the current RJ FM branding, settings persistence, queue/history policy, and crossfade mixer intact.

The schedule helper remains the source of truth for the window boundaries. In `lib/station.ts`, represent each DZMM window as a stable live track and prepare RJ FM music tracks ahead of the end boundary. The API should return the live stream promptly, while the post-window music is filled and made available early enough for the existing client preload to begin the fade before 3:01 PM. If the live audio repeatedly fails, use the existing track-recovery path to switch to RJ FM music for the remainder of that window rather than leaving the player silent.

In `hooks/use-broadcast.ts`, retain the existing constant-power gain behavior, use four audio slots and a longer preload horizon, recover from stalled, errored, or prematurely ended media with bounded retries, and report a failed track to the station API after retries. Keep live-stream time synchronization disabled; normal song tracks remain synchronized to server time. `app/api/now/route.ts` exposes the small recovery POST used by the player.

## Project structure

- `lib/schedule.ts`: Manila-time program and DZMM live-window definitions.
- `lib/station.ts`: durable station state, queue fill, live-window response, and failed-track recovery.
- `app/api/now/route.ts`: no-cache now-playing GET and failed-track recovery POST.
- `hooks/use-broadcast.ts`: client audio slots, preloading, gain/fades, and source recovery.
- `components/station/radio-player.tsx`: play/pause UI, polling, listener heartbeat, and playback status messages.
- `tests/schedule.test.ts` (or the existing schedule test file): boundary and Sunday regression coverage.

No visual redesign or new brand identity, storage migration, or history-ledger rewrite is part of this change; existing RJ FM wording is standardized where old labels remained.
