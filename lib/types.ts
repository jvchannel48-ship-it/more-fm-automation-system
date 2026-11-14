export type TransmitterWatts = 0 | 5000 | 20000 | 100000
export type CrossfaderCurve = 'transition' | 'smooth' | 'constant-power' | 'dipped' | 'slow-fade' | 'slow-cut' | 'fast-fade' | 'fast-cut' | 'full-cut' | 'scratch-cut'

export interface Track {
  uid: string
  src: string
  startAt: number
  duration: number
  fadeIn: number
  fadeOut: number
  sourceUrl?: string
  sourceRefreshedAt?: number
  kind?: 'music' | 'mor-sync' | 'jingle' | 'commercial' | 'golden-sunday' | 'news' | 'dj-mic'
  title?: string
  morKey?: string
  morExactMatch?: boolean
}

export interface AudioAsset {
  url: string
  pathname?: string
  name: string
  duration: number
}

export interface StationSettings {
  broadcastEnabled: boolean
  boardOperatorEnabled: boolean
  noRepeatEnabled: boolean
  autoDjEnabled: boolean
  morSyncEnabled: boolean
  shuffleEnabled: boolean
  goodVibesEnabled: boolean
  rotationPoolSize: number
  listenerLimit: number
  tagalogOnlyEnabled: boolean
  transmitterWatts: TransmitterWatts
  signOffHour: number
  signOnHour: number
  discoStartHour: number
  discoEndHour: number
  christmasEnabled: boolean
  autoVoiceEnabled: boolean
  autoVoiceAnnouncement: AudioAsset | null
  djMicEnabled: boolean
  newsEnabled: boolean
  nightVolumeEnabled: boolean
  nightVolumeStartHour: number
  nightVolumeEndHour: number
  masterVolume: number
  nightVolumePercent: number
  bassGainDb: number
  crossfaderEnabled: boolean
  crossfaderCurve: CrossfaderCurve
  crossfadeSeconds: number
  replayGainEnabled: boolean
  replayGainTargetLufs: number
  jingleEnabled: boolean
  commercialEnabled: boolean
  jingle: AudioAsset | null
  commercials: Array<AudioAsset | null>
  goldenSunday: AudioAsset | null
  news: AudioAsset | null
  djMic: AudioAsset | null
}

export interface SongRequest {
  id: string
  title: string
  artist: string
  requestedAt: number
  status: 'pending' | 'played' | 'skipped'
}

export interface NowResponse {
  serverTime: number
  offAir: boolean
  boardOperatorEnabled: boolean
  nextOnAir: number | null
  signOffAt: number | null
  tracks: Track[]
  nightVolumeActive: boolean
  audioConfig: Pick<StationSettings, 'masterVolume' | 'nightVolumePercent' | 'bassGainDb' | 'crossfaderEnabled' | 'crossfaderCurve' | 'crossfadeSeconds' | 'replayGainEnabled' | 'replayGainTargetLufs'>
}

export interface PlaybackStats {
  last24Hours: number
  last7Days: number
  topArtists: Array<{ artist: string; plays: number }>
  recentSongs: Array<{ title: string; artist: string; playedAt: number }>
}

export type MorMetadataStatus = 'music' | 'non-music' | 'unrecognized' | 'unavailable'
export type MorSyncStatus = 'SYNCED' | 'HINDI NAKITA YUNG KANTA' | 'MOR SYNC OFF' | 'AUTODJ OFF'

export interface MorNowPlaying {
  status: MorMetadataStatus
  raw: string | null
  title: string | null
  artist: string | null
  key: string | null
  checkedAt: number
}

export interface MorSyncRecord {
  metadata: MorNowPlaying | null
  syncStatus: MorSyncStatus
  lastProcessedKey: string | null
  lastProcessedMatched: boolean | null
  queuedTitle: string | null
  updatedAt: number | null
}

export interface AdminStatus extends StationSettings {
  songsThisWeek: number
  artistsThisHour: number
  queued: number
  listenersNow: number
  totalRatings: number
  pendingRequests: number
  playbackStats: PlaybackStats
  storageUsage?: {
    provider: string
    databaseBytes: number
    stationAudioBytes: number
    stationAudioFiles: number
    measuredAt: number
  }
  morNowPlayingTitle: string | null
  morNowPlayingArtist: string | null
  morNowPlayingRaw: string | null
  morNowPlayingStatus: MorMetadataStatus | null
  moreFmNowPlaying: string | null
  morSyncStatus: MorSyncStatus
  morCheckedAt: number | null
  dailyPlayedTitles: Array<{ title: string; artist: string; playedAt: number }>
  dailyPlayedDate: string
}
