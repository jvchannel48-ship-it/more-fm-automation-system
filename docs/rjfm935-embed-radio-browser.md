# RJ FM 93.5 embed and Radio Browser

## Website iframe embed

The minimal station-locked player is served at:

`/embed/rjfm935`

Example:

```html
<iframe
  src="https://more-fm-automation-system-bgah.onrender.com/embed/rjfm935"
  title="RJ FM 93.5"
  width="320"
  height="90"
  loading="lazy"
  allow="autoplay"
  style="border:0;max-width:100%;overflow:hidden"
></iframe>
```

The embedded page always requests `/api/now?station=main`; it does not read the parent website's station selection or the listener's saved station. The listener must press Play because browsers generally block audible autoplay without a user gesture.

## Radio Browser

Do not submit the website homepage or the iframe page as the Radio Browser stream URL. Radio Browser expects a directly playable, continuously available audio stream URL. RJ FM's current web player receives a timed track schedule from `/api/now` and plays multiple track sources in the browser; that API response is not itself an audio stream.

A proper Radio Browser listing therefore remains pending until a persistent server-side audio output is provisioned (for example, an Icecast-compatible mount fed by a continuously running encoder/relay). That service needs an always-on host, source credentials, monitoring/restart behavior, and sufficient outbound bandwidth. Once provisioned and tested, use its direct mount URL as Radio Browser's `url` and this website as `homepage`.

No placeholder or guessed stream URL is published here.
