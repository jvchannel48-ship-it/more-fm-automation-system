# RJ FM request queue and gapless AutoDJ plan

## Scope
Implement the listener-facing song request flow and make the existing AutoDJ queue continuously advance while keeping the existing no-repeat and low-storage architecture.
For the follow-up, keep the uploaded RJ FM logo and RJ FM public identity, display the ABS-CBN Complex location, and validate Render disk writability before claiming filesystem persistence.

## Implementation
- Add a public request endpoint that validates a song title and artist, persists the request, searches the existing YouTube/MP3 provider path, and immediately appends a playable request track behind the current queue when a match is available.
- Keep pending requests durable so AutoDJ can retry them on later queue fills; associate queued tracks with request IDs and remove requests only after the track finishes.
- Reuse the current no-repeat ledger and queued-title deduplication so a requested title cannot create a duplicate rotation entry.
- Add a bottom-position request button and modal form with title/artist fields, submit progress, success/waiting/error states, and accessible status messaging.
- Strengthen the browser audio recovery loop by retrying stalled active sources automatically, refreshing the source through the existing `/api/now` recovery path, and preloading audio slots before Play so the current track can buffer in advance.
- Use the persisted crossfader choice and prepare the incoming track muted across the look-ahead window, so the outgoing song fades down while the next fades up without a midpoint loudness dip.
- Keep public route metadata synchronized and validate with the existing tests, TypeScript/build checks, and focused queue tests.

## Project structure
- `app/api/requests/route.ts`: public request submission API.
- `components/station/song-request-form.tsx`: listener form and status UI.
- `lib/station.ts`: request matching, queue insertion, completion cleanup, and AutoDJ coordination.
- `lib/storage.ts` and `lib/types.ts`: durable request and track metadata.
- `hooks/use-broadcast.ts`: client playback, preload, and automatic recovery.
- `app/page.tsx`, `public/manus-routes.json`: public placement and route declaration.

## Design
- **Quiet broadcast console** (0.06): utilitarian dark glass with a restrained request control.
- **Warm community radio** (0.08): friendly amber/blue accents and conversational copy.
- **Signal laboratory** (0.04): technical monospace labels and waveform-like motion.

Chosen: **Warm community radio**. The request action should feel inviting but not compete with playback: a full-width bottom control, compact modal, clear Filipino/English-friendly microcopy, and high-contrast success/loading states. Use the existing palette, rounded glass surfaces, and current Geist typography. Animation is limited to spinner/progress feedback and the existing equalizer so playback remains calm. Brand essence: a dependable Naga livestream that lets listeners join the playlist; personality: responsive, welcoming, continuous.
