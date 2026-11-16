export interface Track {
  uid: string
  src: string
  startAt: number
  duration: number
  fadeIn: number
  fadeOut: number
  christmasLanguage?: 'english' | 'tagalog'
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
  tagalogOnlyEnabled: boolean
  christmasEnabled: boolean
  classicLoveSongsEnabled: boolean
}

export interface NowResponse {
  serverTime: number
  offAir: boolean
  nextOnAir: number | null
  tracks: Track[]
}

export interface AdminStatus extends StationSettings {
  persistenceConfigured: boolean
  listenersNow: number
  songsThisWeek: number
  artistsThisHour: number
  queued: number
}
