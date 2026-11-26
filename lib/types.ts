export interface Track {
  uid: string
  title?: string
  artist?: string
  src: string
  startAt: number
  duration: number
  fadeIn: number
  fadeOut: number
}

export interface StationSettings {
  broadcastEnabled: boolean
  remixMode: boolean
  fullBass: boolean
  autoPost?: boolean
}

export interface NowResponse {
  serverTime: number
  offAir: boolean
  nextOnAir: number | null
  tracks: Track[]
}

export interface AdminStatus extends StationSettings {
  songsThisWeek: number
  artistsThisHour: number
  queued: number
}
