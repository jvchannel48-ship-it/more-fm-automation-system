# RJ FM original playlists

The station uses its own AutoDJ playlist and does not display third-party station metadata.

AutoDJ now reads `data/rj-playlists.json` in this order:

1. `RJ TOP SONGS`
2. `RJ PLAYED`

The tracks are public YouTube links already present in the repository. The server uses the existing `youtube-sr` public search path as a keyless fallback; no YouTube API key is configured or required. The station's persisted no-repeat ledger blocks a title/artist from being scheduled again while it remains in the active rotation window.

The catalog includes era buckets for 1960s, 1970s, 1980s, 1990s, and 2000s, with Tagalog love songs and English love songs. Tracks are queued in deterministic order, subject to no-repeat protection, failed-source recovery, requests, and scheduled station breaks.
