# Implementation plan: DZMM window and continuous playback

## Scope and approach

Continue from current `main` commit `c6644aa`, based on upstream `f5cb1a9`; do not reset the branch or remove any newer changes. Preserve the existing DZMM schedule, notification center, admin features, station persistence, and player behavior. Add the requested English song-request guidance and unit coverage for local clear-all state. The user clarified that the supplied 6.191-second audio starts at 10:00 PM Manila time, then DZMM live starts immediately after it ends, at about 10:00:06 PM. Preserve the existing 6:30 PM TV Patrol transition and all other schedule windows.

The schedule helper remains the source of truth for the window boundaries. In `lib/station.ts`, represent each DZMM window as a stable live track and prepare RJ FM music tracks ahead of the end boundary. The API should return the live stream promptly, while the post-window music is filled and made available early enough for the existing client preload to begin the fade before 3:01 PM. If the live audio repeatedly fails, use the existing track-recovery path to switch to RJ FM music for the remainder of that window rather than leaving the player silent.

In `hooks/use-broadcast.ts`, retain the existing constant-power gain behavior, use four audio slots and a longer preload horizon, recover from stalled, errored, or prematurely ended media with bounded retries, and report a failed track to the station API after retries. Keep live-stream time synchronization disabled; normal song tracks remain synchronized to server time. `app/api/now/route.ts` exposes the small recovery POST used by the player.

## Project structure

- `lib/schedule.ts`: Manila-time program and DZMM live-window definitions.
- `lib/station.ts`: durable station state, queue fill, live-window response, and failed-track recovery.
- `public/audio/`: user-supplied Love Connect ident and the existing TV Patrol transition audio.
- `app/api/audio/route.ts`: proxy external approved media; station response mapping serves local `/audio/...` assets directly.
- `app/api/now/route.ts`: no-cache now-playing GET and failed-track recovery POST.
- `hooks/use-broadcast.ts`: client audio slots, preloading, gain/fades, and source recovery.
- `components/station/radio-player.tsx`: play/pause UI, polling, listener heartbeat, and playback status messages.
- `components/station/notification-center.tsx`: listener notification sheet, unread badge, read state, and browser-local dismissals.
- `lib/notification-state.ts` and `tests/notification-state.test.ts`: pure clear/read/dismiss state transitions and their unit coverage.
- `components/station/song-request.tsx`: listener-facing song-request copy and form.
- `app/api/notifications/route.ts` and `lib/notifications.ts`: shared station announcements; leave this global storage/API unchanged for the local clear action.
- `tests/schedule.test.ts` (or the existing schedule test file): boundary and Sunday regression coverage.

No visual redesign, station rename, storage migration, or history-ledger rewrite is part of this change; preserve the current station labels and existing UI style.

## Notification-center clear-all behavior

Add a clearly labeled **Clear all** control in `components/station/notification-center.tsx`. It dismisses the notifications currently shown for this browser only, records their IDs in local storage, clears their unread badge contribution, and displays a friendly empty state. New server notifications arriving later remain visible. Do not add a global DELETE endpoint or erase the shared station notification store, because that would remove announcements for every listener. Preserve the existing open-to-mark-read behavior, unread badge, notification attachments, and periodic refresh.

Add a unit test for the same state helpers used by the component: clear all current visible messages, add them to dismissed/read IDs without mutating the shared notification list, preserve any new message after clearing, and keep saved ID lists bounded/deduplicated.

## Song-request wording

Use the English helper copy: “Enter the song title and artist. Your request will be queued for the next available slot.” Do not mention AutoDJ or Betadash in listener-facing text.

## Evening DZMM audio cue (confirmed timing)

The supplied audio says “Las diyes ng gabi na. Love Connect na! Kasama si Coach Vanessa Antonio.” Play it at 10:00 PM Manila time and start the existing DZMM stream immediately after the 6.191-second clip ends (about 10:00:06 PM). Keep the current scheduled window boundary at 10:00 PM, so its first six seconds are the ident, and preserve the distinct TV Patrol announcement at 6:30 PM. Post-midnight continuations must attach to the previous evening's 10 PM start; Monday 12:00–2:59 AM remains music-only because the prior Sunday schedule is music-only. Serve project-local public audio directly rather than routing it through the external-source allowlist; keep the existing proxy for remote music and the DZMM live stream.
