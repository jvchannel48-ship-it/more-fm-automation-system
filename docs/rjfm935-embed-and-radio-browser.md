# RJ FM 93.5 Embed Player and Radio Browser

## 1. Embed RJ FM 93.5 on another website

The standalone player is available at:

`/embed/rjfm935`

Example iframe:

```html
<iframe
  src="https://more-fm-automation-system-bgah.onrender.com/embed/rjfm935"
  title="RJ FM 93.5"
  width="320"
  height="88"
  loading="lazy"
  allow="autoplay"
  referrerpolicy="strict-origin-when-cross-origin"
  style="border:0;max-width:100%;overflow:hidden"
></iframe>
```

The embed is locked to station ID `main`; it does not read the visitor's saved station and does not show the station selector. The listener must tap Play because browsers generally block audible autoplay until a user gesture.

## 2. Radio Browser continuous stream endpoint

The app's existing AutoDJ is a scheduled playlist returned by `/api/now` and played by the browser. It is not itself a continuous audio stream, so do not submit the website URL, the iframe URL, or `/api/now` as a Radio Browser stream URL.

A configurable streaming proxy is provided at:

`https://more-fm-automation-system-bgah.onrender.com/api/radio-stream`

**This endpoint is not ready for Radio Browser until a real, continuous upstream audio stream is configured.** It returns HTTP 503 when the upstream is missing.

### Required deployment configuration

In the hosting service's environment settings, set:

- `RJFM_UPSTREAM_STREAM_URL`: the actual, continuously running RJ FM audio stream URL from an Icecast/Shoutcast server or another compatible streaming provider.

The upstream must serve audio continuously (for example, an MP3 or Ogg stream). It must not be the RJ FM website, an HTML player page, or the JSON `/api/now` endpoint.

After setting the variable, redeploy and verify that the public `/api/radio-stream` URL responds with an audio content type and sustained audio bytes. Only then submit that URL to Radio Browser as the station's **stream URL**. Enter the website URL separately as the station **homepage**.

### Operational note

The proxy relays an upstream stream; it does not encode the app's playlist into Icecast or create a broadcast server. A continuously running encoder/source and streaming host are still required. Keep the upstream URL private if it contains credentials, and use the hosting provider's secret environment-variable facility.
