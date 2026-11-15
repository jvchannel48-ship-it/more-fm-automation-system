# RJ FM original playlists

The station uses its own AutoDJ playlist and does not display third-party station metadata.

AutoDJ now reads `data/rj-playlists.json` in this order:

1. `RJ TOP SONGS`
2. `RJ PLAYED`

The tracks are public YouTube links curated into the repository. The server uses the existing `youtube-sr` public search path as a keyless fallback; no YouTube API key is configured or required. The station's persisted no-repeat ledger blocks a title/artist from being scheduled again while it remains in the active rotation window. If the next sequential track is already blocked, AutoDJ scans forward for the next eligible playlist track before falling back to its emergency catalog.

The catalog includes era buckets for 1960s, 1970s, 1980s, 1990s, 2000s, and 2020s, with Tagalog love songs and English love songs. Tracks are queued in deterministic order, subject to no-repeat protection, failed-source recovery, requests, and scheduled station breaks.
