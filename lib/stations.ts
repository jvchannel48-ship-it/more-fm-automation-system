export type StationId = 'main' | 'naga' | 'cebu' | 'gensan' | 'cdo' | 'davao' | 'iloilo' | 'masbate' | 'calabanga'

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
  notificationTagline: string
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
    name: 'RJ FM Manila',
    shortName: 'RJ FM Manila',
    city: 'Manila',
    frequency: '93.5',
    description: 'Your Home of Music',
    notificationTagline: 'RJ FM Manila — Your Home of Music',
    mode: 'main-dzmm',
    shellClass: 'station-main',
    modeLabel: 'Main',
    signOffHour: 4,
    signOnHour: 4,
    statePath: 'station/state-v2.json',
    vinylMark: 'RJ FM',
  },
  naga: {
    id: 'naga',
    name: 'RJ FM Naga',
    shortName: 'RJ FM Naga',
    city: 'Naga',
    frequency: '92.3',
    description: 'Independent 24/7 English and Tagalog love-song AutoDJ',
    notificationTagline: 'RJ FM Naga 92.3',
    mode: 'music',
    shellClass: 'station-naga',
    modeLabel: 'Independent AutoDJ',
    signOffHour: 4,
    signOnHour: 4,
    statePath: 'station/state-naga-v2.json',
    vinylMark: 'NAGA',
  },
  cebu: {
    id: 'cebu',
    name: 'RJ FM Cebu',
    shortName: 'RJ FM Cebu',
    city: 'Cebu',
    frequency: '105.5',
    description: 'Music only',
    notificationTagline: 'RJ FM Cebu 105.5',
    mode: 'music',
    shellClass: 'station-cebu',
    modeLabel: 'Music',
    signOffHour: 4,
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
    notificationTagline: 'RJ FM GenSan 96.3',
    mode: 'music',
    shellClass: 'station-gensan',
    modeLabel: 'Music',
    signOffHour: 4,
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
    notificationTagline: 'RJ FM CDO 102.7',
    mode: 'music',
    shellClass: 'station-cdo',
    modeLabel: 'Music',
    signOffHour: 4,
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
    notificationTagline: 'RJ FM Davao 104.6',
    mode: 'music',
    shellClass: 'station-davao',
    modeLabel: 'Music',
    signOffHour: 4,
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
    description: 'Music only · continuous English and Tagalog love songs',
    notificationTagline: 'RJ FM Iloilo 92.3',
    mode: 'music',
    shellClass: 'station-iloilo',
    modeLabel: 'Music',
    signOffHour: 4,
    signOnHour: 4,
    statePath: 'station/state-iloilo-v2.json',
    vinylMark: 'ILO',
  },
  calabanga: {
    id: 'calabanga',
    name: 'RJ FM Calabanga',
    shortName: 'RJ FM Calabanga',
    city: 'Calabanga · Santa Cruz, Camarines Sur',
    frequency: '95.5',
    description: 'Independent 24/7 English and Tagalog love-song AutoDJ',
    notificationTagline: 'RJ FM Calabanga 95.5',
    mode: 'music',
    shellClass: 'station-calabanga',
    modeLabel: 'Calabanga AutoDJ',
    signOffHour: 4,
    signOnHour: 4,
    statePath: 'station/state-calabanga-v2.json',
    vinylMark: 'CAL',
  },
  masbate: {
    id: 'masbate',
    name: 'RJ FM Masbate',
    shortName: 'RJ FM Masbate',
    city: 'Masbate',
    frequency: '103.9',
    description: 'Tagalog-focused station · joins nationwide Christmas season',
    notificationTagline: 'RJ FM Masbate 103.9',
    mode: 'music',
    shellClass: 'station-masbate',
    modeLabel: 'Tagalog Only',
    signOffHour: 4,
    signOnHour: 4,
    statePath: 'station/state-masbate-v2.json',
    vinylMark: 'MAS',
  },
}

export const STATION_ORDER: StationId[] = ['main', 'naga', 'cebu', 'gensan', 'cdo', 'davao', 'iloilo', 'masbate', 'calabanga']

export function isStationId(value: unknown): value is StationId {
  return typeof value === 'string' && value in STATIONS
}

export function parseStationId(value: unknown): StationId {
  return isStationId(value) ? value : 'main'
}
