import 'server-only'
import { get, put } from '@vercel/blob'
import type { SongRequest, StationSettings } from './types'

const blobToken = process.env.BLOB_READ_WRITE_TOKEN ?? process.env.VERCEL_BLOB_READ_WRITE_TOKEN

export async function readJson<T>(pathname: string, fallback: T): Promise<T> {
  try {
    const result = await get(pathname, { access: 'private', useCache: false, ...(blobToken ? { token: blobToken } : {}) })
    if (!result || !result.stream) return fallback
    const text = await new Response(result.stream).text()
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

export async function writeJson(pathname: string, data: unknown) {
  await put(pathname, JSON.stringify(data), {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
    ...(blobToken ? { token: blobToken } : {}),
  })
}

export const SETTINGS_PATH = 'station/settings.json'
export const STATE_PATH = 'station/state-v2.json'
export const LISTENERS_PATH = 'station/listeners-v1.json'
export const RATINGS_PATH = 'station/ratings-v1.json'
export const REQUESTS_PATH = 'station/requests-v1.json'

export const DEFAULT_SETTINGS: StationSettings = {
  broadcastEnabled: true,
  signOffHour: 1,
  signOnHour: 4,
  discoStartHour: 16,
  discoEndHour: 20,
  christmasEnabled: true,
  djMicEnabled: false,
  newsEnabled: true,
  nightVolumeEnabled: false,
  nightVolumeStartHour: 22,
  nightVolumeEndHour: 6,
  jingleEnabled: false,
  commercialEnabled: false,
  jingle: null,
  commercials: [null, null, null],
  goldenSunday: null,
  news: null,
  djMic: null,
}

export async function getSettings(): Promise<StationSettings> {
  const saved = await readJson<Partial<StationSettings>>(SETTINGS_PATH, {})
  return {
    broadcastEnabled: typeof saved.broadcastEnabled === 'boolean' ? saved.broadcastEnabled : true,
    signOffHour: typeof saved.signOffHour === 'number' && saved.signOffHour >= 0 && saved.signOffHour <= 23 ? saved.signOffHour : 1,
    signOnHour: typeof saved.signOnHour === 'number' && saved.signOnHour >= 0 && saved.signOnHour <= 23 ? saved.signOnHour : 4,
    discoStartHour: typeof saved.discoStartHour === 'number' && saved.discoStartHour >= 0 && saved.discoStartHour <= 23 ? saved.discoStartHour : 16,
    discoEndHour: typeof saved.discoEndHour === 'number' && saved.discoEndHour >= 0 && saved.discoEndHour <= 23 ? saved.discoEndHour : 20,
    christmasEnabled: typeof saved.christmasEnabled === 'boolean' ? saved.christmasEnabled : true,
    djMicEnabled: typeof saved.djMicEnabled === 'boolean' ? saved.djMicEnabled : false,
    newsEnabled: typeof saved.newsEnabled === 'boolean' ? saved.newsEnabled : true,
    nightVolumeEnabled: typeof saved.nightVolumeEnabled === 'boolean' ? saved.nightVolumeEnabled : false,
    nightVolumeStartHour: typeof saved.nightVolumeStartHour === 'number' && saved.nightVolumeStartHour >= 0 && saved.nightVolumeStartHour <= 23 ? saved.nightVolumeStartHour : 22,
    nightVolumeEndHour: typeof saved.nightVolumeEndHour === 'number' && saved.nightVolumeEndHour >= 0 && saved.nightVolumeEndHour <= 23 ? saved.nightVolumeEndHour : 6,
    jingleEnabled: typeof saved.jingleEnabled === 'boolean' ? saved.jingleEnabled : false,
    commercialEnabled: typeof saved.commercialEnabled === 'boolean' ? saved.commercialEnabled : false,
    jingle: saved.jingle && typeof saved.jingle.url === 'string' ? saved.jingle : null,
    commercials: Array.from({ length: 3 }, (_, i) => {
      const asset = saved.commercials?.[i]
      return asset && typeof asset.url === 'string' ? asset : null
    }),
    goldenSunday: saved.goldenSunday && typeof saved.goldenSunday.url === 'string' ? saved.goldenSunday : null,
    news: saved.news && typeof saved.news.url === 'string' ? saved.news : null,
    djMic: saved.djMic && typeof saved.djMic.url === 'string' ? saved.djMic : null,
  }
}

interface RatingState { total: number; voterIds: string[] }

export async function getRatings() {
  const saved = await readJson<Partial<RatingState>>(RATINGS_PATH, {})
  return { total: typeof saved.total === 'number' ? saved.total : 0, voterIds: Array.isArray(saved.voterIds) ? saved.voterIds.filter((id): id is string => typeof id === 'string').slice(-10000) : [] }
}

export async function addRating(voterId: string) {
  const ratings = await getRatings()
  if (ratings.voterIds.includes(voterId)) return ratings
  const next = { total: ratings.total + 1, voterIds: [...ratings.voterIds, voterId].slice(-10000) }
  await writeJson(RATINGS_PATH, next)
  return next
}

export async function getSongRequests() {
  const saved = await readJson<unknown>(REQUESTS_PATH, [])
  return Array.isArray(saved) ? saved.filter((item): item is SongRequest => Boolean(item && typeof item === 'object' && typeof (item as SongRequest).id === 'string' && typeof (item as SongRequest).title === 'string' && typeof (item as SongRequest).artist === 'string' && ['pending', 'played', 'skipped'].includes((item as SongRequest).status))) : []
}

export async function addSongRequest(title: string, artist: string) {
  const requests = await getSongRequests()
  const request: SongRequest = { id: `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, artist, requestedAt: Date.now(), status: 'pending' }
  await writeJson(REQUESTS_PATH, [...requests.slice(-199), request])
  return request
}

export async function updateSongRequest(id: string, status: SongRequest['status']) {
  const requests = await getSongRequests()
  const next = requests.map((request) => request.id === id ? { ...request, status } : request)
  await writeJson(REQUESTS_PATH, next)
  return next.find((request) => request.id === id) ?? null
}
