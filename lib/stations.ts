export type StationId = 'main' | 'cebu' | 'gensan' | 'cdo' | 'davao' | 'iloilo'

/** How this station builds its playlist / live windows. */
export type StationMode =
  | 'main-dzmm' // full DZMM schedule (main 93.5)
  | 'music' // independent music only
  | 'delayed-main' // same songs as main, delayed
  | 'iloilo-dzmm' // short DZMM block only 6:30–8:00 PM

export interface StationMeta {
  id: StationId
  name: string
  shortName: string
  city: string
  frequency: string
  description: string
  mode: StationMode
  /** CSS class on the app shell */
  shellClass: string
  modeLabel: string
  /** Manila local hour when station goes off air (inclusive start of off window) */
  signOffHour: number
  /** Manila local hour when station returns (exclusive end of off window) */
  signOnHour: number
  /** Durable queue path under storage */
  statePath: string
  /** For delayed-main: how many ms behind main */
  delayMs?: number
  /** Vinyl disc short mark */
  vinylMark: string
}

export const STATIONS: Record<StationId, StationMeta> = {
  main: {
    id: 'main',
    name: 'RJ FM',
    shortName: 'RJ FM',
    city: 'Manila',
    frequency: '93.5',
    description: 'Main station',
    mode: 'main-dzmm',
    shellClass: 'station-main',
    modeLabel: 'Main',
    signOffHour: 3,
    signOnHour: 4,
    statePath: 'station/state-v2.json',
    vinylMark: 'RJ FM',
  },
  cebu: {
    id: 'cebu',
    name: 'RJ FM Cebu',
    shortName: 'RJ FM Cebu',
    city: 'Cebu',
    frequency: '105.5',
    description: 'Music only',
    mode: 'music',
    shellClass: 'station-cebu',
    modeLabel: 'Music',
    signOffHour: 0,
    signOnHour: 4,
    statePath: 'station/state-cebu-v2.json',
    vinylMark: 'CEBU',
  },
  gensan: {
    id: 'gensan',
    name: 'RJ FM Gen. Santos',
    shortName: 'RJ FM GenSan',
    city: 'General Santos',
    frequency: '96.3',
    description: 'Music only',
    mode: 'music',
    shellClass: 'station-gensan',
    modeLabel: 'Music',
    signOffHour: 22,
    signOnHour: 4,
    statePath: 'station/state-gensan-v2.json',
    vinylMark: 'GSC',
  },
  cdo: {
    id: 'cdo',
    name: 'RJ FM Cagayan de Oro',
    shortName: 'RJ FM CDO',
    city: 'Cagayan de Oro',
    frequency: '102.7',
    description: 'Music only · own songs',
    mode: 'music',
    shellClass: 'station-cdo',
    modeLabel: 'Music',
    signOffHour: 2,
    signOnHour: 4,
    statePath: 'station/state-cdo-v2.json',
    vinylMark: 'CDO',
  },
  davao: {
    id: 'davao',
    name: 'RJ FM Davao',
    shortName: 'RJ FM Davao',
    city: 'Davao',
    frequency: '104.6',
    description: 'Music only · own songs',
    mode: 'music',
    shellClass: 'station-davao',
    modeLabel: 'Music',
    signOffHour: 3,
    signOnHour: 4,
    statePath: 'station/state-davao-v2.json',
    vinylMark: 'DVO',
  },
  iloilo: {
    id: 'iloilo',
    name: 'RJ FM Iloilo',
    shortName: 'RJ FM Iloilo',
    city: 'Iloilo',
    frequency: '92.3',
    description: 'Regional',
    mode: 'iloilo-dzmm',
    shellClass: 'station-iloilo',
    modeLabel: 'Regional',
    signOffHour: 3,
    signOnHour: 4,
    statePath: 'station/state-iloilo-v2.json',
    vinylMark: 'ILO',
  },
}

export const STATION_ORDER: StationId[] = ['main', 'cebu', 'gensan', 'cdo', 'davao', 'iloilo']

export function isStationId(value: unknown): value is StationId {
  return typeof value === 'string' && value in STATIONS
}

export function parseStationId(value: unknown): StationId {
  return isStationId(value) ? value : 'main'
}
