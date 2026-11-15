import 'server-only'
import { ensureDatabaseTables, getPostgresPool, readJson, writeJson } from './storage'

export type RadioCatalogSong = {
  title: string
  artist: string
  youtube_id: string
  category: string
  language: 'Tagalog' | 'English' | null
  decade: string | null
  picture: string | null
  duration_seconds: number
  playlist_group: 'RJ TOP SONGS' | 'RJ PLAYED'
  sort_order: number
}

let catalogCache: { rows: RadioCatalogSong[] | null; expiresAt: number } | null = null
let catalogLoad: Promise<RadioCatalogSong[] | null> | null = null
let lastCatalogWarningAt = 0
const CATALOG_PATH = 'station/radio-catalog.json'

export async function getRadioCatalogSongs(): Promise<RadioCatalogSong[] | null> {
  const pool = getPostgresPool()
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.rows
  if (catalogLoad) return catalogLoad
  catalogLoad = (async () => {
    try {
      if (!pool) {
        const rows = await readJson<RadioCatalogSong[]>(CATALOG_PATH, [])
        catalogCache = { rows, expiresAt: Date.now() + 10_000 }
        return rows
      }
      await ensureDatabaseTables()
      const result = await pool.query<RadioCatalogSong>(`
        SELECT title, artist, youtube_id, category, language, decade, picture,
               duration_seconds, playlist_group, sort_order
        FROM public.songs
        WHERE is_active = true
        ORDER BY CASE playlist_group WHEN 'RJ TOP SONGS' THEN 0 ELSE 1 END, sort_order, created_at, youtube_id
      `)
      catalogCache = { rows: result.rows, expiresAt: Date.now() + 60_000 }
      return result.rows
    } catch (error) {
      if (Date.now() - lastCatalogWarningAt > 60_000) {
        lastCatalogWarningAt = Date.now()
        console.warn('[morefm] Supabase song catalog unavailable; using bundled playlists', error)
      }
      catalogCache = { rows: null, expiresAt: Date.now() + 15_000 }
      return null
    } finally {
      catalogLoad = null
    }
  })()
  return catalogLoad
}

export async function upsertRadioCatalogSong(input: {
  title: string
  artist: string
  youtubeId: string
  durationSeconds: number
  playlistGroup: RadioCatalogSong['playlist_group']
  category?: string
  picture?: string | null
}) {
  const pool = getPostgresPool()
  if (!pool) {
    const current = await readJson<RadioCatalogSong[]>(CATALOG_PATH, [])
    const existing = current.find((song) => song.youtube_id === input.youtubeId)
    const nextSong: RadioCatalogSong = {
      title: input.title.slice(0, 200),
      artist: input.artist.slice(0, 120),
      youtube_id: input.youtubeId,
      category: input.category ?? 'english',
      language: null,
      decade: null,
      picture: input.picture ?? null,
      duration_seconds: Math.max(60, Math.min(540, Math.round(input.durationSeconds))),
      playlist_group: input.playlistGroup,
      sort_order: existing?.sort_order ?? current.filter((song) => song.playlist_group === input.playlistGroup).reduce((max, song) => Math.max(max, song.sort_order), -1) + 1,
    }
    await writeJson(CATALOG_PATH, [...current.filter((song) => song.youtube_id !== input.youtubeId), nextSong])
    catalogCache = null
    return nextSong
  }
  await ensureDatabaseTables()
  const durationSeconds = Math.max(60, Math.min(540, Math.round(input.durationSeconds)))
  const result = await pool.query<RadioCatalogSong>(`
    INSERT INTO public.songs (title, artist, youtube_id, category, language, decade, picture, duration_seconds, playlist_group, sort_order, is_active)
    VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6, $7, COALESCE((SELECT max(sort_order) + 1 FROM public.songs WHERE playlist_group = $7), 0), true)
    ON CONFLICT (youtube_id) DO UPDATE SET
      title = EXCLUDED.title,
      artist = EXCLUDED.artist,
      picture = EXCLUDED.picture,
      duration_seconds = EXCLUDED.duration_seconds,
      playlist_group = EXCLUDED.playlist_group,
      is_active = true
    RETURNING title, artist, youtube_id, category, language, decade, picture, duration_seconds, playlist_group, sort_order
  `, [input.title.slice(0, 200), input.artist.slice(0, 120), input.youtubeId, input.category ?? 'english', input.picture ?? null, durationSeconds, input.playlistGroup])
  catalogCache = null
  return result.rows[0]
}

export async function deactivateRadioCatalogSong(youtubeId: string) {
  const pool = getPostgresPool()
  if (!pool) {
    const current = await readJson<RadioCatalogSong[]>(CATALOG_PATH, [])
    const next = current.filter((song) => song.youtube_id !== youtubeId)
    if (next.length === current.length) return false
    await writeJson(CATALOG_PATH, next)
    catalogCache = null
    return true
  }
  await ensureDatabaseTables()
  const result = await pool.query<{ youtube_id: string }>(
    'UPDATE public.songs SET is_active = false, updated_at = now() WHERE youtube_id = $1 RETURNING youtube_id',
    [youtubeId],
  )
  catalogCache = null
  return Boolean(result.rowCount)
}

export async function incrementTopPlayed(input: { youtubeId?: string; title: string; artist: string }) {
  const youtubeId = input.youtubeId?.trim()
  const pool = getPostgresPool()
  if (!pool || !youtubeId || !/^[\w-]{6,32}$/.test(youtubeId)) return
  try {
    await ensureDatabaseTables()
    await pool.query(`
      INSERT INTO public.top_played (song_id, youtube_id, title, artist, play_count, last_played_at, updated_at)
      VALUES ((SELECT id FROM public.songs WHERE youtube_id = $1), $1, $2, $3, 1, now(), now())
      ON CONFLICT (youtube_id) DO UPDATE SET
        song_id = COALESCE(EXCLUDED.song_id, public.top_played.song_id),
        title = EXCLUDED.title,
        artist = EXCLUDED.artist,
        play_count = public.top_played.play_count + 1,
        last_played_at = now(),
        updated_at = now()
    `, [youtubeId, input.title.slice(0, 200), input.artist.slice(0, 120)])
  } catch (error) {
    console.warn('[morefm] could not update Supabase top-played count', error)
  }
}

export async function getTopPlayed(limit = 20) {
  const pool = getPostgresPool()
  if (!pool) return []
  try {
    await ensureDatabaseTables()
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)))
    const result = await pool.query(`
      SELECT youtube_id, title, artist, play_count, last_played_at
      FROM public.top_played
      ORDER BY play_count DESC, last_played_at DESC
      LIMIT $1
    `, [safeLimit])
    return result.rows
  } catch (error) {
    console.warn('[morefm] could not load Supabase top-played list', error)
    return []
  }
}
