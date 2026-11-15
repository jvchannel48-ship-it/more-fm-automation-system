import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'

const connectionString = process.env.POSTGRES_URL
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.SUPABASE_DB_URL

if (!connectionString) {
  console.error('Set POSTGRES_URL to your Supabase PostgreSQL connection URI before seeding.')
  process.exit(1)
}

const catalog = JSON.parse(await readFile(new URL('../data/rj-playlists.json', import.meta.url), 'utf8'))
const databaseUrl = new URL(connectionString)
for (const option of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) databaseUrl.searchParams.delete(option)
const pool = new Pool({
  connectionString: databaseUrl.toString(),
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 10_000,
})

function classify(track) {
  const era = String(track.era ?? '')
  const decade = era.startsWith('1960') ? '60s'
    : era.startsWith('1970') ? '70s'
      : era.startsWith('1980') ? '80s'
        : era.startsWith('1990') ? '90s'
          : era.startsWith('2000') || era.startsWith('2020') ? '20s'
            : null
  const language = /tagalog/i.test(track.language ?? '') ? 'Tagalog'
    : /english/i.test(track.language ?? '') ? 'English'
      : null
  return {
    decade,
    language,
    category: decade ?? (language === 'Tagalog' ? 'tagalog' : 'english'),
  }
}

function artistAndTitle(track) {
  const match = track.title.match(/^(.+?)\s+[-–—|:]\s+(.+)$/)
  if (match) return { artist: match[1].trim(), title: match[2].trim() }
  return { artist: track.channel?.trim() || 'Unknown artist', title: track.title.trim() }
}

const tracks = [
  ...catalog.topSongs.map((track, index) => ({ ...track, playlistGroup: 'RJ TOP SONGS', sortOrder: index })),
  ...catalog.played.map((track, index) => ({ ...track, playlistGroup: 'RJ PLAYED', sortOrder: index })),
]
const distinctTracks = [...new Map(tracks.filter((track) => track.id && track.title && track.duration >= 60 && track.duration <= 540).map((track) => [track.id, track])).values()]

try {
  const tableCheck = await pool.query("SELECT to_regclass('public.songs') AS songs")
  if (!tableCheck.rows[0]?.songs) {
    throw new Error('The songs table is missing. Run supabase/migrations/20261115000000_morefm_radio_catalog.sql in Supabase SQL Editor first.')
  }

  for (const track of distinctTracks) {
    const { artist, title } = artistAndTitle(track)
    const { category, decade, language } = classify(track)
    const picture = `https://i.ytimg.com/vi/${encodeURIComponent(track.id)}/hqdefault.jpg`
    await pool.query(`
      INSERT INTO public.songs
        (title, artist, youtube_id, category, language, decade, picture, duration_seconds, playlist_group, sort_order, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, now())
      ON CONFLICT (youtube_id) DO UPDATE SET
        title = EXCLUDED.title,
        artist = EXCLUDED.artist,
        category = EXCLUDED.category,
        language = EXCLUDED.language,
        decade = EXCLUDED.decade,
        picture = EXCLUDED.picture,
        duration_seconds = EXCLUDED.duration_seconds,
        playlist_group = EXCLUDED.playlist_group,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        updated_at = now()
    `, [title, artist, track.id, category, language, decade, picture, Math.round(track.duration), track.playlistGroup, track.sortOrder])
  }

  console.info(`Seeded ${distinctTracks.length} unique RJ tracks into public.songs.`)
} finally {
  await pool.end()
}
