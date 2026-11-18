export type StationId = 'main' | 'cebu'

export const STATIONS: Record<StationId, {
  id: StationId
  name: string
  shortName: string
  frequency: string
  description: string
  /** CSS class on the app shell */
  shellClass: string
  /** Accent label under the player */
  modeLabel: string
}> = {
  main: {
    id: 'main',
    name: 'RJ FM',
    shortName: 'RJ FM',
    frequency: '93.5',
    description: 'DZMM schedule + music',
    shellClass: 'station-main',
    modeLabel: 'DZMM schedule + music',
  },
  cebu: {
    id: 'cebu',
    name: 'RJ FM 105.5 Cebu',
    shortName: 'RJ FM Cebu',
    frequency: '105.5',
    description: 'Music station only',
    shellClass: 'station-cebu',
    modeLabel: 'Music station only',
  },
}

export function isStationId(value: unknown): value is StationId {
  return value === 'main' || value === 'cebu'
}

export function parseStationId(value: unknown): StationId {
  return value === 'cebu' ? 'cebu' : 'main'
}
