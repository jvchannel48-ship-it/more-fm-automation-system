# Implementation plan: DZMM window and continuous playback

## Scope and approach

Continue from the fetched `f5cb1a9` upstream state; do not reset the branch or remove any newer changes. Preserve the existing DZMM schedule, notification center, admin features, station persistence, and player behavior while adding only the requested listener-side clear-all notification action.

The schedule helper remains the source of truth for the window boundaries. In `lib/station.ts`, represent each DZMM window as a stable live track and prepare RJ FM music tracks ahead of the end boundary. The API should return the live stream promptly, while the post-window music is filled and made available early enough for the existing client preload to begin the fade before 3:01 PM. If the live audio repeatedly fails, use the existing track-recovery path to switch to RJ FM music for the remainder of that window rather than leaving the player silent.

In `hooks/use-broadcast.ts`, retain the existing constant-power gain behavior, use four audio slots and a longer preload horizon, recover from stalled, errored, or prematurely ended media with bounded retries, and report a failed track to the station API after retries. Keep live-stream time synchronization disabled; normal song tracks remain synchronized to server time. `app/api/now/route.ts` exposes the small recovery POST used by the player.

## Project structure

- `lib/schedule.ts`: Manila-time program and DZMM live-window definitions.
- `lib/station.ts`: durable station state, queue fill, live-window response, and failed-track recovery.
- `app/api/now/route.ts`: no-cache now-playing GET and failed-track recovery POST.
- `hooks/use-broadcast.ts`: client audio slots, preloading, gain/fades, and source recovery.
- `components/station/radio-player.tsx`: play/pause UI, polling, listener heartbeat, and playback status messages.
- `components/station/notification-center.tsx`: listener notification sheet, unread badge, read state, and browser-local dismissals.
- `app/api/notifications/route.ts` and `lib/notifications.ts`: shared station announcements; leave this global storage/API unchanged for the local clear action.
- `tests/schedule.test.ts` (or the existing schedule test file): boundary and Sunday regression coverage.

No visual redesign or new brand identity, storage migration, or history-ledger rewrite is part of this change; existing RJ FM wording is standardized where old labels remained.

## Notification-center clear-all behavior

Add a clearly labeled **Clear all** control in `components/station/notification-center.tsx`. It dismisses the notifications currently shown for this browser only, records their IDs in local storage, clears their unread badge contribution, and displays a friendly empty state. New server notifications arriving later remain visible. Do not add a global DELETE endpoint or erase the shared station notification store, because that would remove announcements for every listener. Preserve the existing open-to-mark-read behavior, unread badge, notification attachments, and periodic refresh.
