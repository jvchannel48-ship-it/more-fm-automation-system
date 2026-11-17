export interface Track {
  uid: string
  src: string
  startAt: number
  duration: number
  fadeIn: number
  fadeOut: number
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
}

export interface NowResponse {
  serverTime: number
  offAir: boolean
  nextOnAir: number | null
  tracks: Track[]
}

export interface AdminStatus extends StationSettings {
  newTagalogNext: boolean
  persistenceConfigured: boolean
  listenersNow: number
  songsThisWeek: number
  artistsThisHour: number
  queued: number
}
