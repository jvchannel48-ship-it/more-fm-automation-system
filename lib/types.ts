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
}

export interface NowResponse {
  serverTime: number
  offAir: boolean
  nextOnAir: number | null
  tracks: Track[]
  bassBoostDb: number
}

export interface AdminStatus extends StationSettings {
  persistenceConfigured: boolean
  listenersNow: number
  songsThisWeek: number
  artistsThisHour: number
  queued: number
}
