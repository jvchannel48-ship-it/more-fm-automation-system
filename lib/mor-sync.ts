import 'server-only'
import type { MorNowPlaying } from './types'

const DEFAULT_MOR_MOUNT = '0ha8ftewqp8uv'
const METADATA_TIMEOUT_MS = 9_000
const NON_MUSIC_LABEL = /\b(commercial|advert(?:isement|ising)?|sponsored|promo(?:tion)?|station\s*(?:id|identification|break)|jingle|news(?:cast| bulletin| update)?|headline|bulletin|traffic|weather|podcast|interview|talk\s*show|dj\s*talk|announcer|public\s*service\s*announcement|contest|program(?:me)?\s*intro|show\s*intro)\b/i
const FILE_EXTENSION = /\.(?:mp3|m4a|aac|wav|ogg|flac|mpeg|mp4)$/i

function cleanText(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240)
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function normalizeMorMatchText(value: string) {
  return value.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(?:official|music|video|lyrics?|audio|remastered|remaster|hd|hq|4k|mv)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function parseMorStreamTitle(input: string, checkedAt = Date.now()): MorNowPlaying {
  const raw = cleanText(input)
  let value = raw
    .replace(/^(?:now\s*playing|stream\s*title|on\s*air)\s*[:–—-]\s*/i, '')
    .replace(/^(?:[A-Z]{1,4}\d{1,3})\s+/, '')
    .replace(FILE_EXTENSION, '')
    .trim()

  if (!value || NON_MUSIC_LABEL.test(value)) {
    return { status: 'non-music', raw: raw || null, title: null, artist: null, key: null, checkedAt }
  }

  const parts = value.split(/\s+(?:[-–—|]|::)\s+/, 2).map((part) => cleanText(part))
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { status: 'unrecognized', raw: raw || null, title: null, artist: null, key: null, checkedAt }
  }

  const artist = parts[0].replace(/\s*\((?:official|lyrics?|audio|music video|hd|hq)\)$/i, '').trim()
  value = parts[1].replace(/\s*\((?:official|lyrics?|audio|music video|hd|hq)\)$/i, '').trim()
  if (!artist || !value || NON_MUSIC_LABEL.test(`${artist} ${value}`)) {
    return { status: 'non-music', raw: raw || null, title: null, artist: null, key: null, checkedAt }
  }

  const key = normalize(`${artist} ${value}`)
  if (key.length < 4) {
    return { status: 'unrecognized', raw: raw || null, title: null, artist: null, key: null, checkedAt }
  }
  return { status: 'music', raw: raw || null, title: value, artist, key, checkedAt }
}

function unavailable(checkedAt: number): MorNowPlaying {
  return { status: 'unavailable', raw: null, title: null, artist: null, key: null, checkedAt }
}

function parseEventData(frame: string): string | null {
  const data = frame.split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
  if (!data) return null
  try {
    const value = JSON.parse(data) as { streamTitle?: unknown; title?: unknown; artist?: unknown }
    if (typeof value.title === 'string' && typeof value.artist === 'string') return `${value.artist} - ${value.title}`
    return typeof value.streamTitle === 'string' ? value.streamTitle : null
  } catch {
    return null
  }
}

export async function fetchMorNowPlaying(): Promise<MorNowPlaying> {
  const checkedAt = Date.now()
  const mount = (process.env.MOR_ZENO_MOUNT ?? DEFAULT_MOR_MOUNT).trim()
  if (!/^[a-z0-9-]{3,80}$/i.test(mount)) return unavailable(checkedAt)

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  try {
    const response = await fetch(`https://api.zeno.fm/mounts/metadata/subscribe/${encodeURIComponent(mount)}`, {
      headers: { Accept: 'text/event-stream' },
      cache: 'no-store',
      signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
    })
    if (!response.ok || !response.body) return unavailable(checkedAt)

    reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split(/\r?\n\r?\n/)
      buffer = frames.pop() ?? ''
      for (const frame of frames) {
        const title = parseEventData(frame)
        if (title) return parseMorStreamTitle(title, checkedAt)
      }
      if (buffer.length > 4_096) buffer = buffer.slice(-1_024)
    }
  } catch {
    return unavailable(checkedAt)
  } finally {
    if (reader) await reader.cancel().catch(() => undefined)
  }
  return unavailable(checkedAt)
}
