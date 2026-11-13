import 'server-only'
import { Pool } from 'pg'
import type { SongRequest, StationSettings } from './types'

const databaseUrl = process.env.POSTGRES_URL
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.SUPABASE_DB_URL

type MoreFmGlobals = typeof globalThis & {
  __moreFmPostgresPool?: Pool
  __moreFmSchemaPromise?: Promise<void>
}
const globals = globalThis as MoreFmGlobals
const memoryState = new Map<string, string>()
const STATION_STATE_PATH = 'station/state-v2.json'
export const hasPersistentStorage = Boolean(databaseUrl)

function getPool() {
  if (!databaseUrl) return null
  if (!globals.__moreFmPostgresPool) {
    // Keep TLS enabled while avoiding connection-string SSL options that force strict certificate verification.
    const connectionUrl = new URL(databaseUrl)
    for (const option of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) connectionUrl.searchParams.delete(option)
    globals.__moreFmPostgresPool = new Pool({
      connectionString: connectionUrl.toString(),
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    })
  }
  return globals.__moreFmPostgresPool
}

async function ensureStateTable() {
  const pool = getPool()
  if (!pool) throw new Error('Supabase Postgres is not configured for this deployment.')
  if (!globals.__moreFmSchemaPromise) {
    globals.__moreFmSchemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS public.morefm_state (
        storage_key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE public.morefm_state ENABLE ROW LEVEL SECURITY;
    `).then(() => undefined).catch((error) => {
      globals.__moreFmSchemaPromise = undefined
      throw error
    })
  }
  await globals.__moreFmSchemaPromise
}

export async function readJson<T>(pathname: string, fallback: T): Promise<T> {
  const pool = getPool()
  if (!pool) {
    if (pathname === STATION_STATE_PATH) {
      const cached = memoryState.get(pathname)
      if (cached) {
        try { return JSON.parse(cached) as T } catch { /* Ignore a corrupted process-local entry. */ }
      }
    }
    return fallback
  }
  await ensureStateTable()
  const result = await pool.query<{ value: T }>(
    'SELECT value FROM public.morefm_state WHERE storage_key = $1 LIMIT 1',
    [pathname],
  )
  return result.rows[0]?.value ?? fallback
}

export async function writeJson(pathname: string, data: unknown) {
  const serialized = JSON.stringify(data)
  if (serialized === undefined) throw new Error('State value could not be serialized as JSON.')
  const pool = getPool()
  if (!pool) {
    if (pathname === STATION_STATE_PATH) {
      memoryState.set(pathname, serialized)
      return
    }
    throw new Error('Supabase Postgres is not configured for this deployment.')
  }
  await ensureStateTable()
  await pool.query(
    `INSERT INTO public.morefm_state (storage_key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (storage_key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [pathname, serialized],
  )
}

export const SETTINGS_PATH = 'station/settings.json'
export const STATE_PATH = STATION_STATE_PATH
export const LISTENERS_PATH = 'station/listeners-v1.json'
export const RATINGS_PATH = 'station/ratings-v1.json'
export const REQUESTS_PATH = 'station/requests-v1.json'
export const DEFAULT_SETTINGS: StationSettings = {
  broadcastEnabled: true,
  autoDjEnabled: true,
  tagalogOnlyEnabled: false,
  transmitterWatts: 100000,
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
  jingleEnabled: true,
  commercialEnabled: false,
  jingle: { url: '/my-only-radio-for-life.mp3', name: 'MyOnlyRadioforLife-usesuno.com.mp3', duration: 11.833 },
  commercials: [null, null, null],
  goldenSunday: null,
  news: null,
  djMic: null,
}

export async function getSettings(): Promise<StationSettings> {
  const saved = await readJson<Partial<StationSettings>>(SETTINGS_PATH, {})
  return {
    broadcastEnabled: typeof saved.broadcastEnabled === 'boolean' ? saved.broadcastEnabled : true,
    autoDjEnabled: typeof saved.autoDjEnabled === 'boolean' ? saved.autoDjEnabled : true,
    tagalogOnlyEnabled: typeof saved.tagalogOnlyEnabled === 'boolean' ? saved.tagalogOnlyEnabled : false,
    transmitterWatts: [0, 5000, 20000, 100000].includes(saved.transmitterWatts as number) ? saved.transmitterWatts as StationSettings['transmitterWatts'] : 100000,
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
    jingleEnabled: saved.jingle && typeof saved.jingle.url === 'string' && typeof saved.jingleEnabled === 'boolean' ? saved.jingleEnabled : true,
    commercialEnabled: typeof saved.commercialEnabled === 'boolean' ? saved.commercialEnabled : false,
    jingle: saved.jingle && typeof saved.jingle.url === 'string' ? saved.jingle : DEFAULT_SETTINGS.jingle,
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
  return {
    total: typeof saved.total === 'number' ? saved.total : 0,
    voterIds: Array.isArray(saved.voterIds) ? saved.voterIds.filter((id): id is string => typeof id === 'string').slice(-10000) : [],
  }
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
  return Array.isArray(saved) ? saved.filter((item): item is SongRequest => Boolean(
    item && typeof item === 'object'
    && typeof (item as SongRequest).id === 'string'
    && typeof (item as SongRequest).title === 'string'
    && typeof (item as SongRequest).artist === 'string'
    && ['pending', 'played', 'skipped'].includes((item as SongRequest).status),
  )) : []
}
export async function addSongRequest(title: string, artist: string) {
  const requests = await getSongRequests()
  const request: SongRequest = {
    id: `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    artist,
    requestedAt: Date.now(),
    status: 'pending',
  }
  await writeJson(REQUESTS_PATH, [...requests.slice(-199), request])
  return request
}
export async function updateSongRequest(id: string, status: SongRequest['status']) {
  const requests = await getSongRequests()
  const next = requests.map((request) => request.id === id ? { ...request, status } : request)
  await writeJson(REQUESTS_PATH, next)
  return next.find((request) => request.id === id) ?? null
}
