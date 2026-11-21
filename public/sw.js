const CACHE_NAME = 'rjfm-offline-v2'
const APP_SHELL = ['/', '/offline.html', '/manifest.json', '/rjfm-app-icon.svg']
const MAX_CACHED_AUDIO_BYTES = 20 * 1024 * 1024

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('rjfm-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

async function cacheAudioResponse(request, response) {
  if (!response || response.status !== 200 || !response.ok) return
  if (request.headers.has('range') || response.status === 206) return
  const type = response.headers.get('content-type') || ''
  if (!type.includes('audio') && !/\\.mp3(?:$|\\?)/i.test(new URL(request.url).pathname)) return
  const length = Number(response.headers.get('content-length') || 0)
  if (length > MAX_CACHED_AUDIO_BYTES) return
  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, response.clone())
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/now') || url.pathname.startsWith('/api/admin') || url.pathname.startsWith('/api/notifications')) return

  const isAudio = url.pathname.startsWith('/audio/') || url.pathname === '/api/audio'
  if (isAudio) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(request)
      try {
        const response = await fetch(request)
        if (response.status === 200) {
          event.waitUntil(cacheAudioResponse(request, response.clone()))
        }
        return response
      } catch {
        if (cached) return cached
        return new Response('Audio is not available offline. Play a track while connected to cache it first.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    })())
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(request, response.clone())
          await cache.put('/', response.clone())
        }
        return response
      } catch {
        return (await caches.match(request)) || (await caches.match('/')) || (await caches.match('/offline.html')) || Response.error()
      }
    })())
    return
  }

  if (url.pathname === '/manifest.json' || url.pathname === '/rjfm-app-icon.svg' || url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) await cache.put(request, response.clone())
      return response
    })())
  }
})


self.addEventListener('message', (event) => {
  const message = event.data
  if (!message || message.type !== 'RJFM_PURGE_PLAYED_AUDIO' || typeof message.url !== 'string') return
  let url
  try { url = new URL(message.url, self.location.origin) } catch { return }
  if (url.origin !== self.location.origin) return
  if (!(url.pathname.startsWith('/audio/') || url.pathname === '/api/audio')) return
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.delete(url.toString()))
  )
})
