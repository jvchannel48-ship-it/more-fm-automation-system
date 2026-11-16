export interface Track {
  uid: string
  src: string
  startAt: number
  duration: number
  fadeIn: number
  fadeOut: number
}

export interface StationSettings {
  broadcastEnabled: boolean
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
