export const MAX_BASS_BOOST_DB = 12

export interface Track {
  uid: string
  src: string
  startAt: number
  duration: number
  fadeIn: number
  fadeOut: number
  kind?: 'music' | 'dj-mic' | 'live'
  title?: string
  artist?: string
}

export interface SongRequest {
  requestId: string
  title: string
  artist: string
  submittedAt: number
  id: string
  key: string
  src: string
  duration: number
}

export interface StationSettings {
  broadcastEnabled: boolean
  sundayScheduleEnabled: boolean
  newTagalogOpmEnabled: boolean
  bassBoostDb: number
  songRequestsEnabled?: boolean
  transmitterWatts: 5000 | 25000
  blockedGenres: string[]
  /** When false, disco/dance is blocked on ALL stations */
  discoEnabled: boolean
  rjOfficialAutoEnabled: boolean
  rjOfficialAutoMessage: string
  rjFmNationwideEnabled: boolean
  songRequestsEnabled: boolean
}

export interface LiveDjState {
  active: boolean
  name: string
  stationId?: string
  updatedAt: number
}

export interface ListenerMessage {
  id: string
  fromName: string
  body: string
  createdAt: number
  read: boolean
}

export interface NowResponse {
  serverTime: number
  offAir: boolean
  nextOnAir: number | null
  tracks: Track[]
  bassBoostDb: number
  transmitterWatts: 5000 | 25000
  liveDj?: LiveDjState | null
}

export interface AdminStatus extends StationSettings {
  persistenceConfigured: boolean
  listenersNow: number
  averageListeners: number
  songsThisWeek: number
  artistsThisHour: number
  queued: number
}
