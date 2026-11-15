import 'server-only'
import { ensureDatabaseTables, getPostgresPool } from './storage'

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

export async function getRadioCatalogSongs(): Promise<RadioCatalogSong[] | null> {
  const pool = getPostgresPool()
  if (!pool) return null
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.rows
  if (catalogLoad) return catalogLoad
  catalogLoad = (async () => {
    try {
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
