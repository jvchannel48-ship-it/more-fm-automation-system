export type TransmitterWatts = 0 | 5000 | 20000 | 100000

export interface Track {
  uid: string
  src: string
  startAt: number
  duration: number
  fadeIn: number
  fadeOut: number
  sourceUrl?: string
  sourceRefreshedAt?: number
  kind?: 'music' | 'jingle' | 'commercial' | 'golden-sunday' | 'news' | 'dj-mic'
  title?: string
}

export interface AudioAsset {
  url: string
  pathname?: string
  name: string
  duration: number
}

export interface StationSettings {
  broadcastEnabled: boolean
  autoDjEnabled: boolean
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
  nextOnAir: number | null
  signOffAt: number | null
  tracks: Track[]
  nightVolumeActive: boolean
}

export interface AdminStatus extends StationSettings {
  songsThisWeek: number
  artistsThisHour: number
  queued: number
  listenersNow: number
  totalRatings: number
  pendingRequests: number
  storageUsage?: {
    provider: string
    databaseBytes: number
    stationAudioBytes: number
    stationAudioFiles: number
    measuredAt: number
  }
}
