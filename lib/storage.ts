import 'server-only'
import { randomUUID } from 'node:crypto'
import { accessSync, constants as fsConstants, mkdirSync } from 'node:fs'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Pool } from 'pg'
import type { CrossfaderCurve, MorSyncRecord, SongRequest, StationSettings } from './types'
import { hasSupabaseStorageConfig, readSupabaseJson, writeSupabaseJson } from './supabase-media.ts'

// Accept the connection-variable names used by Render, Vercel/Neon,
// Supabase integrations, and standard Node database deployments.
const databaseUrl = process.env.POSTGRES_URL
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.DATABASE_URL_UNPOOLED
  ?? process.env.NEON_DATABASE_URL
  ?? process.env.SUPABASE_DB_URL
  ?? process.env.SUPABASE_DATABASE_URL
// Render persistent disks survive clear-build-cache deploys. Do not advertise
// filesystem persistence unless the configured mount is actually writable.
const configuredFilesystemDataDir = process.env.MORE_FM_DATA_DIR?.trim() || ''
function resolveWritableFilesystemDataDir() {
  if (!configuredFilesystemDataDir) return ''
  try {
    mkdirSync(configuredFilesystemDataDir, { recursive: true })
    accessSync(configuredFilesystemDataDir, fsConstants.W_OK)
    return configuredFilesystemDataDir
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (['EACCES', 'EPERM', 'EROFS', 'ENOENT', 'ENOTDIR'].includes(code ?? '')) {
      console.warn('[morefm] configured station disk is not writable; using available fallbacks', code)
      return ''
    }
    throw error
  }
}
const filesystemDataDir = resolveWritableFilesystemDataDir()

type MoreFmGlobals = typeof globalThis & {
  __moreFmPostgresPool?: Pool
  __moreFmSchemaPromise?: Promise<void>
}
const globals = globalThis as MoreFmGlobals
const memoryState = new Map<string, string>()
const memoryLeases = new Map<string, { owner: string; expiresAt: number }>()
const memoryListeners = new Map<string, { lastSeenAt: number }>()
const memoryRequests: SongRequest[] = []
const settingsObjectCache = new Map<string, { value: unknown; expiresAt: number }>()
const STATION_STATE_PATH = 'station/state-v2.json'
export const hasFilesystemPersistence = Boolean(filesystemDataDir)
export const hasPersistentStorage = Boolean(databaseUrl) || hasFilesystemPersistence
export const hasSettingsPersistence = hasPersistentStorage || hasSupabaseStorageConfig()
export const hasQueuePersistence = hasPersistentStorage || hasSupabaseStorageConfig()
const SETTINGS_CACHE_TTL_MS = 2_000

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

function filesystemPath(pathname: string) {
  if (!filesystemDataDir) return null
  const root = path.resolve(/* turbopackIgnore: true */ filesystemDataDir)
  const target = path.resolve(root, pathname)
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Invalid station storage path.')
  return target
}

async function readFilesystemJson<T>(pathname: string): Promise<T | undefined> {
  const target = filesystemPath(pathname)
  if (!target) return undefined
  try {
    return JSON.parse(await readFile(/* turbopackIgnore: true */ target, 'utf8')) as T
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return undefined
    if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
      console.warn('[morefm] station disk is not readable; using local fallback', pathname, code)
      return undefined
    }
    throw error
  }
}

async function writeFilesystemJson(pathname: string, serialized: string) {
  const target = filesystemPath(pathname)
  if (!target) return false
  await mkdir(path.dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, serialized, 'utf8')
    await rename(temporary, target)
  } finally {
    await unlink(temporary).catch(() => undefined)
  }
  return true
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
      ALTER TABLE public.morefm_listeners DROP COLUMN IF EXISTS country_code;
      ALTER TABLE public.morefm_listeners DROP COLUMN IF EXISTS region;
      ALTER TABLE public.morefm_listeners DROP COLUMN IF EXISTS city;
      ALTER TABLE public.morefm_state ENABLE ROW LEVEL SECURITY;
      CREATE TABLE IF NOT EXISTS public.songs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL,
        artist text NOT NULL,
        youtube_id text NOT NULL UNIQUE,
        category text NOT NULL CHECK (category IN ('60s', '70s', '80s', '90s', '20s', 'tagalog', 'english')),
        language text CHECK (language IS NULL OR language IN ('Tagalog', 'English')),
        decade text CHECK (decade IS NULL OR decade IN ('60s', '70s', '80s', '90s', '20s')),
        picture text,
        duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 60 AND 540),
        playlist_group text NOT NULL DEFAULT 'RJ TOP SONGS' CHECK (playlist_group IN ('RJ TOP SONGS', 'RJ PLAYED')),
        sort_order integer NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS songs_active_playlist_idx ON public.songs (is_active, playlist_group, sort_order);
      CREATE TABLE IF NOT EXISTS public.requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL DEFAULT 'Listener',
        song_title text NOT NULL,
        artist text,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'played', 'skipped')),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS requests_status_created_idx ON public.requests (status, created_at DESC);
      CREATE TABLE IF NOT EXISTS public.top_played (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
        youtube_id text NOT NULL UNIQUE,
        title text NOT NULL,
        artist text NOT NULL,
        play_count bigint NOT NULL DEFAULT 0 CHECK (play_count >= 0),
        last_played_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS top_played_rank_idx ON public.top_played (play_count DESC, last_played_at DESC);
      ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.top_played ENABLE ROW LEVEL SECURITY;
    `).then(() => undefined).catch((error) => {
      globals.__moreFmSchemaPromise = undefined
      throw error
    })
  }
  await globals.__moreFmSchemaPromise
}

export function getPostgresPool() {
  return getPool()
}

export async function ensureDatabaseTables() {
  await ensureStateTable()
}

export async function readJson<T>(pathname: string, fallback: T): Promise<T> {
  const pool = getPool()
  if (!pool) {
    if (hasSupabaseStorageConfig()) {
      const cached = settingsObjectCache.get(pathname)
      if (isPersistentSettingsPath(pathname) && cached && cached.expiresAt > Date.now()) return JSON.parse(JSON.stringify(cached.value)) as T
      try {
        const remote = await readSupabaseJson(`app-state/${pathname}`)
        if (remote !== null) {
          if (isPersistentSettingsPath(pathname)) settingsObjectCache.set(pathname, { value: remote, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS })
          return remote as T
        }
      } catch (error) {
        // Render's persistent disk is the local recovery path when Supabase
        // Storage is temporarily unavailable or its bucket is misconfigured.
        // If no disk is attached, continue with process-local station state so
        // the public now-playing endpoint can still recover instead of 500ing.
        console.warn('[morefm] Supabase JSON read failed; using local fallback', pathname)
      }
    }
    const filesystemValue = await readFilesystemJson<T>(pathname)
    if (filesystemValue !== undefined) return filesystemValue
    const cached = memoryState.get(pathname)
    if (cached) {
      try { return JSON.parse(cached) as T } catch { /* Ignore a corrupted process-local entry. */ }
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
    if (hasSupabaseStorageConfig()) {
      const value = JSON.parse(serialized)
      try {
        await writeSupabaseJson(`app-state/${pathname}`, value)
        if (isPersistentSettingsPath(pathname)) settingsObjectCache.set(pathname, { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS })
        return
      } catch (error) {
        // Continue to the Render disk fallback below when available.
        // Station queue state can also use the existing process-local fallback
        // on single-instance hosts without a persistent disk.
        console.warn('[morefm] Supabase JSON write failed; using local fallback', pathname)
      }
    }
    try {
      if (await writeFilesystemJson(pathname, serialized)) return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (!['EACCES', 'EPERM', 'EROFS', 'ENOENT'].includes(code ?? '')) throw error
      console.warn('[morefm] station disk is not writable; using process-local state', code)
    }
    memoryState.set(pathname, serialized)
    return
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
  if (!pool) {
    const cutoff = Date.now() - 60_000
    for (const [listenerId, listener] of memoryListeners) if (listener.lastSeenAt < cutoff) memoryListeners.delete(listenerId)
    const alreadyActive = memoryListeners.has(id)
    const accepted = !active || alreadyActive || listenerLimit <= 0 || memoryListeners.size < listenerLimit
    if (active && accepted) memoryListeners.set(id, { lastSeenAt: Date.now() })
    if (!active) memoryListeners.delete(id)
    return { accepted, listenersNow: memoryListeners.size }
  }
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
          `INSERT INTO public.morefm_listeners (listener_id, last_seen_at)
           VALUES ($1, now())
           ON CONFLICT (listener_id) DO UPDATE
           SET last_seen_at = now()`,
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
    provider: databaseUrl ? 'Render PostgreSQL' : hasSupabaseStorageConfig() ? 'Supabase Storage' : 'Local fallback',
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
const SETTINGS_MIGRATIONS_PATH = 'station/settings-migrations-v1.json'
function isPersistentSettingsPath(pathname: string) {
  return pathname === SETTINGS_PATH || pathname === SETTINGS_MIGRATIONS_PATH
}
export const EMPTY_MOR_SYNC_RECORD: MorSyncRecord = {
  metadata: null,
  syncStatus: 'HINDI NAKITA YUNG KANTA',
  lastProcessedKey: null,
  lastProcessedMatched: null,
  queuedTitle: null,
  updatedAt: null,
}

function isLegacyShowtimeAsset(asset: { url?: unknown; name?: unknown }) {
  const value = `${typeof asset.url === 'string' ? asset.url : ''} ${typeof asset.name === 'string' ? asset.name : ''}`.toLowerCase()
  return value.includes('my-only-radio-for-life') || value.includes('myonlyradioforlife') || /it['’]?s[\s_-]*show[\s_-]*time/.test(value)
}

const CROSSFADER_CURVES: readonly CrossfaderCurve[] = ['transition', 'smooth', 'constant-power', 'dipped', 'slow-fade', 'slow-cut', 'fast-fade', 'fast-cut', 'full-cut', 'scratch-cut']
const isCrossfaderCurve = (value: unknown): value is CrossfaderCurve => CROSSFADER_CURVES.includes(value as CrossfaderCurve)

export const DEFAULT_SETTINGS: StationSettings = {
  broadcastEnabled: true,
  rjMakatiEnabled: false,
  rjMakatiScheduleEnabled: false,
  rjMakatiScheduleStartHour: 0,
  rjMakatiScheduleEndHour: 6,
  boardOperatorEnabled: false,
  noRepeatEnabled: true,
  autoDjEnabled: true,
  morSyncEnabled: false,
  shuffleEnabled: false,
  goodVibesEnabled: false,
  rotationPoolSize: 100,
  listenerLimit: 2,
  tagalogOnlyEnabled: true,
  transmitterWatts: 100000,
  signOffHour: 1,
  signOnHour: 4,
  discoStartHour: 16,
  discoEndHour: 19,
  christmasEnabled: false,
  autoVoiceEnabled: false,
  autoVoiceAnnouncement: null,
  djMicEnabled: false,
  newsEnabled: true,
  nightVolumeEnabled: true,
  nightVolumeStartHour: 22,
  nightVolumeEndHour: 6,
  masterVolume: 80,
  nightVolumePercent: 70,
  bassGainDb: 12,
  crossfaderEnabled: true,
  crossfaderCurve: 'constant-power',
  crossfadeSeconds: 8,
  replayGainEnabled: false,
  replayGainTargetLufs: -14,
  jingleEnabled: false,
  commercialEnabled: false,
  jingle: {
    url: '/rj-fm-jingle.mp3',
    name: 'RjFm-usesuno.com.mp3',
    duration: 8.04,
  },
  commercials: [null, null, null],
  goldenSunday: null,
  news: null,
  djMic: null,
}

export async function getSettings(): Promise<StationSettings> {
  const saved = await readJson<Partial<StationSettings>>(SETTINGS_PATH, {})
  const migrations = await readJson<{ tagalogLoveRotation?: number; crossfaderCurve?: number; listenerLimit?: number }>(SETTINGS_MIGRATIONS_PATH, {})
  const needsTagalogMigration = migrations.tagalogLoveRotation !== 2
  const needsCrossfaderMigration = migrations.crossfaderCurve !== 1
  const needsListenerLimitMigration = migrations.listenerLimit !== 1
  if (hasSettingsPersistence && (needsTagalogMigration || needsCrossfaderMigration || needsListenerLimitMigration)) {
    const migrated = {
      ...saved,
      ...(needsTagalogMigration ? {
        tagalogOnlyEnabled: typeof saved.tagalogOnlyEnabled === 'boolean' ? saved.tagalogOnlyEnabled : true,
        noRepeatEnabled: typeof saved.noRepeatEnabled === 'boolean' ? saved.noRepeatEnabled : true,
        shuffleEnabled: false,
      } : {}),
      ...(needsCrossfaderMigration ? {
        crossfaderCurve: isCrossfaderCurve(saved.crossfaderCurve) && saved.crossfaderCurve !== 'smooth'
          ? saved.crossfaderCurve
          : 'constant-power',
      } : {}),
      ...(needsListenerLimitMigration ? {
        listenerLimit: typeof saved.listenerLimit === 'number' && saved.listenerLimit > 0 ? saved.listenerLimit : DEFAULT_SETTINGS.listenerLimit,
      } : {}),
    }
    const nextMigrations = {
      ...migrations,
      ...(needsTagalogMigration ? { tagalogLoveRotation: 2 } : {}),
      ...(needsCrossfaderMigration ? { crossfaderCurve: 1 } : {}),
      ...(needsListenerLimitMigration ? { listenerLimit: 1 } : {}),
    }
    try {
      await writeJson(SETTINGS_PATH, migrated)
      await writeJson(SETTINGS_MIGRATIONS_PATH, nextMigrations)
      Object.assign(saved, migrated)
    } catch (error) {
      console.error('[morefm] could not apply station settings migrations', error)
    }
  }
  return {
    broadcastEnabled: typeof saved.broadcastEnabled === 'boolean' ? saved.broadcastEnabled : true,
    rjMakatiEnabled: typeof saved.rjMakatiEnabled === 'boolean' ? saved.rjMakatiEnabled : DEFAULT_SETTINGS.rjMakatiEnabled,
    rjMakatiScheduleEnabled: typeof saved.rjMakatiScheduleEnabled === 'boolean' ? saved.rjMakatiScheduleEnabled : DEFAULT_SETTINGS.rjMakatiScheduleEnabled,
    rjMakatiScheduleStartHour: typeof saved.rjMakatiScheduleStartHour === 'number' && saved.rjMakatiScheduleStartHour >= 0 && saved.rjMakatiScheduleStartHour <= 23 ? Math.round(saved.rjMakatiScheduleStartHour) : DEFAULT_SETTINGS.rjMakatiScheduleStartHour,
    rjMakatiScheduleEndHour: typeof saved.rjMakatiScheduleEndHour === 'number' && saved.rjMakatiScheduleEndHour >= 0 && saved.rjMakatiScheduleEndHour <= 23 ? Math.round(saved.rjMakatiScheduleEndHour) : DEFAULT_SETTINGS.rjMakatiScheduleEndHour,
    boardOperatorEnabled: typeof saved.boardOperatorEnabled === 'boolean' ? saved.boardOperatorEnabled : false,
    // Keep song rotation from repeating titles across the active daily history.
    noRepeatEnabled: true,
    autoDjEnabled: true,
    morSyncEnabled: typeof saved.morSyncEnabled === 'boolean' ? saved.morSyncEnabled : false,
    shuffleEnabled: false,
    goodVibesEnabled: typeof saved.goodVibesEnabled === 'boolean' ? saved.goodVibesEnabled : false,
    rotationPoolSize: typeof saved.rotationPoolSize === 'number' ? Math.max(50, Math.min(300, Math.round(saved.rotationPoolSize))) : 100,
    listenerLimit: typeof saved.listenerLimit === 'number' ? Math.max(0, Math.min(1000, Math.round(saved.listenerLimit))) : DEFAULT_SETTINGS.listenerLimit,
    tagalogOnlyEnabled: typeof saved.tagalogOnlyEnabled === 'boolean' ? saved.tagalogOnlyEnabled : true,
    transmitterWatts: [0, 5000, 20000, 100000].includes(saved.transmitterWatts as number) ? saved.transmitterWatts as StationSettings['transmitterWatts'] : 100000,
    signOffHour: typeof saved.signOffHour === 'number' && saved.signOffHour >= 0 && saved.signOffHour <= 23 ? Math.round(saved.signOffHour) : DEFAULT_SETTINGS.signOffHour,
    signOnHour: typeof saved.signOnHour === 'number' && saved.signOnHour >= 0 && saved.signOnHour <= 23 ? Math.round(saved.signOnHour) : DEFAULT_SETTINGS.signOnHour,
    discoStartHour: typeof saved.discoStartHour === 'number' && saved.discoStartHour >= 0 && saved.discoStartHour <= 23 ? Math.round(saved.discoStartHour) : DEFAULT_SETTINGS.discoStartHour,
    discoEndHour: typeof saved.discoEndHour === 'number' && saved.discoEndHour >= 0 && saved.discoEndHour <= 23 ? Math.round(saved.discoEndHour) : DEFAULT_SETTINGS.discoEndHour,
    christmasEnabled: false,
    autoVoiceEnabled: false,
    autoVoiceAnnouncement: saved.autoVoiceAnnouncement && typeof saved.autoVoiceAnnouncement.url === 'string' ? saved.autoVoiceAnnouncement : null,
    djMicEnabled: typeof saved.djMicEnabled === 'boolean' ? saved.djMicEnabled : false,
    newsEnabled: typeof saved.newsEnabled === 'boolean' ? saved.newsEnabled : true,
    // Automatic audio profile: 80% daytime, 70% from 10 PM–6 AM, maximum bass.
    nightVolumeEnabled: true,
    nightVolumeStartHour: 22,
    nightVolumeEndHour: 6,
    masterVolume: 80,
    nightVolumePercent: 70,
    bassGainDb: 12,
    crossfaderEnabled: typeof saved.crossfaderEnabled === 'boolean' ? saved.crossfaderEnabled : true,
    crossfaderCurve: needsCrossfaderMigration && saved.crossfaderCurve === 'smooth'
      ? DEFAULT_SETTINGS.crossfaderCurve
      : isCrossfaderCurve(saved.crossfaderCurve) ? saved.crossfaderCurve : DEFAULT_SETTINGS.crossfaderCurve,
    crossfadeSeconds: typeof saved.crossfadeSeconds === 'number' && Number.isFinite(saved.crossfadeSeconds)
      ? Math.max(0, Math.min(30, saved.crossfadeSeconds))
      : DEFAULT_SETTINGS.crossfadeSeconds,
    replayGainEnabled: typeof saved.replayGainEnabled === 'boolean' ? saved.replayGainEnabled : false,
    replayGainTargetLufs: typeof saved.replayGainTargetLufs === 'number' ? Math.max(-24, Math.min(-5, saved.replayGainTargetLufs)) : -14,
    jingleEnabled: saved.jingle ? (typeof saved.jingleEnabled === 'boolean' ? saved.jingleEnabled : true) : true,
    commercialEnabled: typeof saved.commercialEnabled === 'boolean' ? saved.commercialEnabled : false,
    jingle: saved.jingle && typeof saved.jingle.url === 'string' ? saved.jingle : DEFAULT_SETTINGS.jingle,
    commercials: Array.from({ length: 3 }, (_, i) => {
      const asset = saved.commercials?.[i]
      return asset && typeof asset.url === 'string' ? asset : null
    }),
    goldenSunday: null,
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
  const pool = getPool()
  if (pool) {
    await ensureStateTable()
    const result = await pool.query<{ id: string; name: string; song_title: string; artist: string | null; created_at: Date | string; status: SongRequest['status'] }>(
      "SELECT id::text, name, song_title, artist, created_at, status FROM public.requests WHERE status IN ('pending', 'skipped') ORDER BY created_at DESC LIMIT 200",
    )
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      title: row.song_title,
      artist: row.artist || 'Unknown artist',
      requestedAt: new Date(row.created_at).getTime(),
      status: row.status,
    }))
  }
  const saved = hasQueuePersistence ? await readJson<unknown>(REQUESTS_PATH, []) : memoryRequests
  const requests = Array.isArray(saved) ? saved.filter((item): item is SongRequest => Boolean(
    item && typeof item === 'object'
    && typeof (item as SongRequest).id === 'string'
    && typeof (item as SongRequest).title === 'string'
    && typeof (item as SongRequest).artist === 'string'
    && ['pending', 'played', 'skipped'].includes((item as SongRequest).status),
  )) : []
  const activeRequests = requests.filter((request) => request.status !== 'played')
  if (activeRequests.length !== requests.length) await writeJson(REQUESTS_PATH, activeRequests)
  return activeRequests
}
export async function addSongRequest(title: string, artist: string, name = 'Listener') {
  const pool = getPool()
  if (pool) {
    await ensureStateTable()
    const result = await pool.query<{ id: string; name: string; song_title: string; artist: string | null; created_at: Date | string; status: SongRequest['status'] }>(
      "INSERT INTO public.requests (name, song_title, artist) VALUES ($1, $2, $3) RETURNING id::text, name, song_title, artist, created_at, status",
      [name, title, artist || null],
    )
    const row = result.rows[0]
    if (row) return { id: row.id, name: row.name, title: row.song_title, artist: row.artist || 'Unknown artist', requestedAt: new Date(row.created_at).getTime(), status: row.status }
  }
  const requests = await getSongRequests()
  const request: SongRequest = {
    id: `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    artist,
    name,
    requestedAt: Date.now(),
    status: 'pending',
  }
  if (hasQueuePersistence) await writeJson(REQUESTS_PATH, [...requests.slice(-199), request])
  else {
    memoryRequests.splice(0, memoryRequests.length, ...requests.slice(-199), request)
  }
  return request
}
export async function updateSongRequest(id: string, status: SongRequest['status']) {
  const pool = getPool()
  if (pool) {
    await ensureStateTable()
    const result = await pool.query<{ id: string; name: string; song_title: string; artist: string | null; created_at: Date | string; status: SongRequest['status'] }>(
      'UPDATE public.requests SET status = $2 WHERE id = $1::uuid RETURNING id::text, name, song_title, artist, created_at, status',
      [id, status],
    )
    const row = result.rows[0]
    if (!row) return null
    return { id: row.id, name: row.name, title: row.song_title, artist: row.artist || 'Unknown artist', requestedAt: new Date(row.created_at).getTime(), status: row.status }
  }
  const requests = await getSongRequests()
  const updated = requests.find((request) => request.id === id)
  if (!updated) return null
  const next = status === 'played'
    ? requests.filter((request) => request.id !== id)
    : requests.map((request) => request.id === id ? { ...request, status } : request)
  if (hasQueuePersistence) await writeJson(REQUESTS_PATH, next)
  else memoryRequests.splice(0, memoryRequests.length, ...next)
  return { ...updated, status }
}
