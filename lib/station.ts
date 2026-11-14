import 'server-only'
import { acquireStationLease, EMPTY_MOR_SYNC_RECORD, getRatings, getSettings, hasQueuePersistence, MOR_SYNC_PATH, QUEUE_LOCK_PATH, readJson, releaseStationLease, renewStationLease, STATE_PATH, writeJson } from './storage'
import { getListenerCount } from './listeners'
import { isChristmasTitle, isNightVolumeWindow, isOffAir, languageForSlot, manilaDateKey, MANILA_OFFSET_MS, manilaTime, nextSignOff, nextSignOn, PROGRAMS, programAt, type Artist, type Program } from './schedule'
import type { AdminStatus, MorSyncRecord, NowResponse, Track } from './types'
import { appendCompletedSong, isCompletedDailyMusicTrack, isInPlaybackQueue, repeatTitleKey, rollDailyPlayedLog } from './song-repeat'
import { fetchMorNowPlaying, normalizeMorMatchText } from './mor-sync'
import { hasBlacklistedTitle, isAllowedTrack } from './track-filter'

const API_BASE = 'https://betadash-api-swordslush-production.up.railway.app/mp3juice/api'
const SONG_REPEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const ARTIST_WINDOW_MS = 60 * 60 * 1000
const MAX_ARTIST_PLAYS_PER_HOUR = 2
const FILL_LOCK_MS = 45_000
const QUEUE_LEASE_MS = 100_000
const SOURCE_REFRESH_WINDOW_MS = 110_000
const SOURCE_REFRESH_RETRY_MS = 45_000
// Refresh an already-playing track's download URL more often so expired
// free-converter links are replaced before the client hits a hard media error.
const ACTIVE_SOURCE_REFRESH_AFTER_MS = 35_000
const PRELOAD_QUEUE_WITH_ACTIVE_TRACKS = 2
const PRELOAD_QUEUE_WITHOUT_ACTIVE_TRACK = 1
const REJECTED_TITLE_RULE = /\b(?:it['’]?s?\s+show\s*time|show\s*time|live\s+concerts?|concerts?\s+live)\b/i
const SHOWTIME_METADATA_RULE = /\b(?:it['’]?s?\s+show\s*time|show\s*time)\b/i
// Coalesce simultaneous listener polls that land in the same server runtime.
let activeQueueFill: Promise<void> | null = null

function playableSource(url: string) {
  return url.startsWith('/api/audio?') ? url : `/api/audio?url=${encodeURIComponent(url)}`
}

function monitorStationLease(lease: { pathname: string; owner: string }) {
  let valid = true
  let renewal = Promise.resolve()
  const timer = setInterval(() => {
    renewal = renewal.then(async () => {
      if (valid) valid = await renewStationLease(lease, QUEUE_LEASE_MS)
    }).catch((error) => {
      valid = false
      console.error('[morefm] queue lease renewal failed', error)
    })
  }, 20_000)
  timer.unref()
  return {
    isValid: async () => { await renewal; return valid },
    stop: async () => { clearInterval(timer); await renewal },
  }
}

interface HistoryEntry {
  id: string
  key: string
  artist: string
  title?: string
  t: number
}

interface StationState {
  tracks: Track[]
  songCount: number
  history: HistoryEntry[]
  fillingUntil: number
  lastBreakSongCount: number
  lastNewsDate: string
  dailyPlayedDate: string
  dailyPlayedTitles: import('./song-repeat').DailyPlayedSong[]
}

const EMPTY_STATE: StationState = { tracks: [], songCount: 0, history: [], fillingUntil: 0, lastBreakSongCount: 0, lastNewsDate: '', dailyPlayedDate: '', dailyPlayedTitles: [] }
