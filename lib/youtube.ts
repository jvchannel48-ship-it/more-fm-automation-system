import 'server-only'

export interface YouTubeSearchItem {
  id: string
  title: string
  url: string
  duration: string
  channel?: string
  author?: string
  uploader?: string
  source?: string
  description?: string
  live?: boolean
  isLive?: boolean
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function text(value: unknown): string {
  if (typeof value === 'string') return decodeHtml(value)
  if (!value || typeof value !== 'object') return ''
  const record = value as { simpleText?: unknown; runs?: Array<{ text?: unknown }> }
  if (typeof record.simpleText === 'string') return decodeHtml(record.simpleText)
  return Array.isArray(record.runs) ? record.runs.map((run) => typeof run?.text === 'string' ? run.text : '').join('') : ''
}

function readObject(source: string, start: number): string | null {
  const open = source.indexOf('{', start)
  if (open < 0) return null
  let depth = 0
  let quoted = false
  let escaped = false
  for (let i = open; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
      continue
    }
    if (char === '"') quoted = true
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) return source.slice(open, i + 1)
  }
  return null
}

async function fetchPage(url: string, timeoutMs: number) {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    },
  })
  return response.ok ? response.text() : null
}

export async function searchYouTube(query: string): Promise<YouTubeSearchItem[]> {
  const html = await fetchPage(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, 8_000)
  if (!html) return []
  const results: YouTubeSearchItem[] = []
  let cursor = 0
  while (results.length < 40) {
    const marker = html.indexOf('"videoRenderer":', cursor)
    if (marker < 0) break
    cursor = marker + 15
    const json = readObject(html, cursor)
    if (!json) break
    try {
      const item = JSON.parse(json) as {
        videoId?: unknown
        title?: unknown
        lengthText?: unknown
        ownerText?: unknown
        shortDescription?: unknown
        isLiveNow?: unknown
        badges?: Array<{ metadataBadgeRenderer?: { label?: unknown } }>
      }
      const id = typeof item.videoId === 'string' ? item.videoId : ''
      const title = text(item.title)
      const duration = text(item.lengthText)
      const channel = text(item.ownerText)
      const live = item.isLiveNow === true || item.badges?.some((badge) => /live/i.test(String(badge.metadataBadgeRenderer?.label ?? '')))
      if (id && title) results.push({ id, title, url: `https://www.youtube.com/watch?v=${id}`, duration, channel, author: channel, uploader: channel, source: 'YouTube', description: text(item.shortDescription), live })
    } catch {
      // YouTube occasionally embeds an incomplete renderer while the page is loading.
    }
  }
  return results
}

export async function resolveYouTubeAudio(videoUrl: string): Promise<{ downloadUrl: string } | null> {
  const videoId = new URL(videoUrl).searchParams.get('v')
  const pages = [await fetchPage(videoUrl, 12_000)]
  if (videoId) pages.push(await fetchPage(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`, 12_000))
  for (const html of pages) {
    if (!html) continue
    const embedded = html.match(/"embedded_player_response":"((?:\\.|[^"\\])*)"/)
    const embeddedJson = embedded ? (() => {
      try { return JSON.parse(JSON.parse(`"${embedded[1]}"`)) as { streamingData?: { adaptiveFormats?: Array<{ mimeType?: string; bitrate?: number; url?: string }> } } } catch { return null }
    })() : null
    const candidates = embeddedJson ? [embeddedJson] : []
    const markers = ['var ytInitialPlayerResponse = ', '"ytInitialPlayerResponse":']
    for (const marker of markers) {
      const index = html.indexOf(marker)
      if (index < 0) continue
      const json = readObject(html, index + marker.length)
      if (!json) continue
      try { candidates.push(JSON.parse(json)) } catch { /* try the next response variant */ }
    }
    for (const player of candidates) {
      const formats = (player.streamingData?.adaptiveFormats ?? [])
        .filter((format) => format.mimeType?.startsWith('audio/') && typeof format.url === 'string')
        .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))
      if (formats[0]?.url) return { downloadUrl: formats[0].url }
    }
  }
  return null
}
