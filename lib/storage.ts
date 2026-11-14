import 'server-only'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import type { CrossfaderCurve, MorSyncRecord, SongRequest, StationSettings } from './types'

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
const memoryLeases = new Map<string, { owner: string; expiresAt: number }>()
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
      CREATE TABLE IF NOT EXISTS public.morefm_listeners (
        listener_id text PRIMARY KEY,
        last_seen_at timestamptz NOT NULL DEFAULT now()
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

export interface StationLease {
  pathname: string
  owner: string
}

/** Atomically acquire a time-limited lease in Postgres so separate server instances serialize queue changes. */
export async function acquireStationLease(pathname: string, leaseMs: number): Promise<StationLease | null> {
  const owner = randomUUID()
  const expiresAt = Date.now() + leaseMs
  const pool = getPool()
  if (!pool) {
    const current = memoryLeases.get(pathname)
    if (current && current.expiresAt > Date.now()) return null
    memoryLeases.set(pathname, { owner, expiresAt })
    return { pathname, owner }
  }
  await ensureStateTable()
  const result = await pool.query<{ owner: string }>(
    `INSERT INTO public.morefm_state (storage_key, value, updated_at)
     VALUES ($1, jsonb_build_object('owner', $2::text, 'expiresAt', $3::bigint), now())
     ON CONFLICT (storage_key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = now()
     WHERE CASE
       WHEN public.morefm_state.value->>'expiresAt' ~ '^[0-9]+$'
       THEN (public.morefm_state.value->>'expiresAt')::bigint
       ELSE 0
     END <= $4::bigint
     RETURNING value->>'owner' AS owner`,
    [pathname, owner, expiresAt, Date.now()],
  )
  return result.rows[0]?.owner === owner ? { pathname, owner } : null
}

/** Delete only the lease owned by the caller; a newer lease is never disturbed. */
export async function releaseStationLease(lease: StationLease) {
  const pool = getPool()
  if (!pool) {
    if (memoryLeases.get(lease.pathname)?.owner === lease.owner) memoryLeases.delete(lease.pathname)
    return
  }
  await ensureStateTable()
  await pool.query(
    "DELETE FROM public.morefm_state WHERE storage_key = $1 AND value->>'owner' = $2",
    [lease.pathname, lease.owner],
  )
}

/** Extend only a still-live lease owned by this operation; false means another instance may now own the queue. */
export async function renewStationLease(lease: StationLease, leaseMs: number): Promise<boolean> {
  const now = Date.now()
  const expiresAt = now + leaseMs
  const pool = getPool()
  if (!pool) {
    const current = memoryLeases.get(lease.pathname)
    if (!current || current.owner !== lease.owner || current.expiresAt <= now) return false
    memoryLeases.set(lease.pathname, { owner: lease.owner, expiresAt })
    return true
  }
  await ensureStateTable()
  const result = await pool.query(
    `UPDATE public.morefm_state
     SET value = jsonb_set(value, '{expiresAt}', to_jsonb($3::bigint), true), updated_at = now()
     WHERE storage_key = $1 AND value->>'owner' = $2
       AND CASE
         WHEN value->>'expiresAt' ~ '^[0-9]+$' THEN (value->>'expiresAt')::bigint
         ELSE 0
       END > $4::bigint
     RETURNING storage_key`,
    [lease.pathname, lease.owner, expiresAt, now],
  )
  return result.rowCount === 1
}

export async function registerListener(id: string, active: boolean, listenerLimit: number) {
  const pool = getPool()
  if (!pool) throw new Error('Supabase Postgres is not configured for this deployment.')
  await ensureStateTable()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('morefm_listener_admission'))")
    await client.query("DELETE FROM public.morefm_listeners WHERE last_seen_at < now() - interval '60 seconds'")
    let accepted = true
    if (active) {
      const existing = await client.query('SELECT 1 FROM public.morefm_listeners WHERE listener_id = $1', [id])
      const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM public.morefm_listeners')
      if (existing.rowCount === 0 && listenerLimit > 0 && Number(count.rows[0]?.count ?? 0) >= listenerLimit) {
        accepted = false
      } else {
        await client.query(
          `INSERT INTO public.morefm_listeners (listener_id, last_seen_at) VALUES ($1, now())
           ON CONFLICT (listener_id) DO UPDATE SET last_seen_at = now()`,
          [id],
        )
      }
    } else {
      await client.query('DELETE FROM public.morefm_listeners WHERE listener_id = $1', [id])
    }
    const count = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM public.morefm_listeners')
    await client.query('COMMIT')
    return { accepted, listenersNow: Number(count.rows[0]?.count ?? 0) }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function getStoredListenerCount() {
  const pool = getPool()
  if (!pool) return getListenerCountFromState()
  await ensureStateTable()
  await pool.query("DELETE FROM public.morefm_listeners WHERE last_seen_at < now() - interval '60 seconds'")
  const result = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM public.morefm_listeners')
  return Number(result.rows[0]?.count ?? 0)
}

async function getListenerCountFromState() {
  const listeners = await readJson<Record<string, number>>(LISTENERS_PATH, {})
  const cutoff = Date.now() - 60_000
  return Object.values(listeners).filter((seenAt) => seenAt >= cutoff).length
}

export async function getStorageUsage() {
  const pool = getPool()
  if (!pool) throw new Error('Supabase Postgres is not configured for this deployment.')
  await ensureStateTable()
  const result = await pool.query<{ database_bytes: string; audio_bytes: string; audio_files: string }>(`
    SELECT
      pg_database_size(current_database())::text AS database_bytes,
      COALESCE((SELECT sum(NULLIF(metadata->>'size', '')::bigint) FROM storage.objects WHERE bucket_id = 'more-fm-media'), 0)::text AS audio_bytes,
      COALESCE((SELECT count(*) FROM storage.objects WHERE bucket_id = 'more-fm-media'), 0)::text AS audio_files
  `)
  const row = result.rows[0]
  return {
    provider: 'Supabase connected to Vercel',
    databaseBytes: Number(row?.database_bytes ?? 0),
    stationAudioBytes: Number(row?.audio_bytes ?? 0),
    stationAudioFiles: Number(row?.audio_files ?? 0),
    measuredAt: Date.now(),
  }
}

export const SETTINGS_PATH = 'station/settings.json'
export const STATE_PATH = STATION_STATE_PATH
export const LISTENERS_PATH = 'station/listeners-v1.json'
export const RATINGS_PATH = 'station/ratings-v1.json'
export const REQUESTS_PATH = 'station/requests-v1.json'
export const MOR_SYNC_PATH = 'station/mor-sync-v1.json'
export const QUEUE_LOCK_PATH = 'station/queue-lock-v1.json'
export const EMPTY_MOR_SYNC_RECORD: MorSyncRecord = {
  metadata: null,
  syncStatus: 'HINDI NAKITA YUNG KANTA',
  lastProcessedKey: null,
  lastProcessedMatched: null,
  queuedTitle: null,
  updatedAt: null,
}
export const DEFAULT_SETTINGS: StationSettings = {
  broadcastEnabled: true,
  autoDjEnabled: true,
  morSyncEnabled: false,
  shuffleEnabled: true,
  goodVibesEnabled: false,
  rotationPoolSize: 100,
  listenerLimit: 0,
  tagalogOnlyEnabled: false,
  transmitterWatts: 100000,
  signOffHour: 1,
  signOnHour: 4,
  discoStartHour: 16,
  discoEndHour: 20,
  christmasEnabled: true,
  autoVoiceEnabled: false,
  autoVoiceAnnouncement: null,
  djMicEnabled: false,
  newsEnabled: true,
  nightVolumeEnabled: false,
  nightVolumeStartHour: 22,
  nightVolumeEndHour: 6,
  masterVolume: 100,
  nightVolumePercent: 72,
  bassGainDb: 0,
  crossfaderEnabled: true,
  crossfaderCurve: 'constant-power',
  crossfadeSeconds: 8,
  replayGainEnabled: false,
  replayGainTargetLufs: -14,
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
    morSyncEnabled: typeof saved.morSyncEnabled === 'boolean' ? saved.morSyncEnabled : false,
    shuffleEnabled: typeof saved.shuffleEnabled === 'boolean' ? saved.shuffleEnabled : true,
    goodVibesEnabled: typeof saved.goodVibesEnabled === 'boolean' ? saved.goodVibesEnabled : false,
    rotationPoolSize: typeof saved.rotationPoolSize === 'number' ? Math.max(50, Math.min(100, Math.round(saved.rotationPoolSize))) : 100,
    listenerLimit: typeof saved.listenerLimit === 'number' ? Math.max(0, Math.min(1000, Math.round(saved.listenerLimit))) : 0,
    tagalogOnlyEnabled: typeof saved.tagalogOnlyEnabled === 'boolean' ? saved.tagalogOnlyEnabled : false,
    transmitterWatts: [0, 5000, 20000, 100000].includes(saved.transmitterWatts as number) ? saved.transmitterWatts as StationSettings['transmitterWatts'] : 100000,
    signOffHour: typeof saved.signOffHour === 'number' && saved.signOffHour >= 0 && saved.signOffHour <= 23 ? saved.signOffHour : 1,
    signOnHour: typeof saved.signOnHour === 'number' && saved.signOnHour >= 0 && saved.signOnHour <= 23 ? saved.signOnHour : 4,
    discoStartHour: typeof saved.discoStartHour === 'number' && saved.discoStartHour >= 0 && saved.discoStartHour <= 23 ? saved.discoStartHour : 16,
    discoEndHour: typeof saved.discoEndHour === 'number' && saved.discoEndHour >= 0 && saved.discoEndHour <= 23 ? saved.discoEndHour : 20,
    christmasEnabled: typeof saved.christmasEnabled === 'boolean' ? saved.christmasEnabled : true,
    autoVoiceEnabled: typeof saved.autoVoiceEnabled === 'boolean' ? saved.autoVoiceEnabled : false,
    autoVoiceAnnouncement: saved.autoVoiceAnnouncement && typeof saved.autoVoiceAnnouncement.url === 'string' ? saved.autoVoiceAnnouncement : null,
    djMicEnabled: typeof saved.djMicEnabled === 'boolean' ? saved.djMicEnabled : false,
    newsEnabled: typeof saved.newsEnabled === 'boolean' ? saved.newsEnabled : true,
    nightVolumeEnabled: typeof saved.nightVolumeEnabled === 'boolean' ? saved.nightVolumeEnabled : false,
    nightVolumeStartHour: typeof saved.nightVolumeStartHour === 'number' && saved.nightVolumeStartHour >= 0 && saved.nightVolumeStartHour <= 23 ? saved.nightVolumeStartHour : 22,
    nightVolumeEndHour: typeof saved.nightVolumeEndHour === 'number' && saved.nightVolumeEndHour >= 0 && saved.nightVolumeEndHour <= 23 ? saved.nightVolumeEndHour : 6,
    masterVolume: typeof saved.masterVolume === 'number' ? Math.max(0, Math.min(100, Math.round(saved.masterVolume))) : 100,
    nightVolumePercent: typeof saved.nightVolumePercent === 'number' ? Math.max(0, Math.min(100, Math.round(saved.nightVolumePercent))) : 72,
    bassGainDb: typeof saved.bassGainDb === 'number' ? Math.max(-12, Math.min(12, saved.bassGainDb)) : 0,
    crossfaderEnabled: typeof saved.crossfaderEnabled === 'boolean' ? saved.crossfaderEnabled : true,
    crossfaderCurve: ['transition', 'smooth', 'constant-power', 'dipped', 'slow-fade', 'slow-cut', 'fast-fade', 'fast-cut', 'full-cut', 'scratch-cut'].includes(saved.crossfaderCurve as string) ? saved.crossfaderCurve as CrossfaderCurve : 'constant-power',
    crossfadeSeconds: typeof saved.crossfadeSeconds === 'number' ? Math.max(0, Math.min(30, saved.crossfadeSeconds)) : 8,
    replayGainEnabled: typeof saved.replayGainEnabled === 'boolean' ? saved.replayGainEnabled : false,
    replayGainTargetLufs: typeof saved.replayGainTargetLufs === 'number' ? Math.max(-24, Math.min(-5, saved.replayGainTargetLufs)) : -14,
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
