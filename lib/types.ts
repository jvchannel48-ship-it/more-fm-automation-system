export interface Track {
  uid: string
  src: string
  startAt: number
  duration: number
  fadeIn: number
  fadeOut: number
  kind?: 'music' | 'jingle' | 'commercial' | 'golden-sunday'
  title?: string
}

export interface AudioAsset {
  url: string
  name: string
  duration: number
}

export interface StationSettings {
  broadcastEnabled: boolean
  signOffHour: number
  signOnHour: number
  discoStartHour: number
  discoEndHour: number
  jingleEnabled: boolean
  commercialEnabled: boolean
  jingle: AudioAsset | null
  commercials: Array<AudioAsset | null>
  goldenSunday: AudioAsset | null
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
  nextOnAir: number | null
  tracks: Track[]
}

export interface AdminStatus extends StationSettings {
  songsThisWeek: number
  artistsThisHour: number
  queued: number
  listenersNow: number
  totalRatings: number
  pendingRequests: number
}
