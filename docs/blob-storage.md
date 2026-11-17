# RJ FM private Blob storage

The app stores station settings (including the Broadcast switch), AutoDJ state, and active-listener heartbeat data as private JSON objects in Vercel Blob. Objects are read and written server-side with private access; the Blob token must never be exposed to browser code or committed to Git.

## Connect a Blob store

1. In the Vercel project that deploys RJ FM, create or attach a Blob store under **Storage**.
2. Connect that store to the deployment so Vercel injects `BLOB_READ_WRITE_TOKEN`. The app also recognizes the Vercel OIDC setup when both `VERCEL_OIDC_TOKEN` and `BLOB_STORE_ID` are available.
3. Redeploy the app after connecting the store or changing environment variables.
4. Open the Admin Panel. It should stop showing the temporary-storage warning after a successful Blob read/write. Toggle Broadcast and confirm it remains in the chosen state after reloading.

For local development, put `BLOB_READ_WRITE_TOKEN` in `.env.local`; do not commit the file or paste the token into chat.

## Listener counter behavior

While playback is active, each browser sends a heartbeat every 30 seconds. A listener is removed when playback stops and otherwise expires after 60 seconds without a heartbeat. The admin dashboard refreshes the active listener total periodically. Blob JSON saves preserve the count across a normal redeploy, but simultaneous writes from multiple server instances are not atomic; use a database with atomic updates if strict multi-instance listener accounting is required.

Without working Blob credentials, settings and listener counts continue in process memory so the station remains usable, but they are temporary and may differ between server instances. The Admin Panel warns about this state.

Blob storage limits and included usage depend on the current Vercel plan. Check the project's current usage and plan before relying on it as a no-cost, unlimited database.
