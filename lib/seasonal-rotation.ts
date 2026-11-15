const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

export const CHRISTMAS_REGULAR_TRACK_INTERVAL = 20

export type ChristmasMode = 'off' | 'single' | 'triple'

export interface ChristmasRotationState {
  regularTracksSinceChristmas: number
  christmasTracksRemaining: number
}

export interface ChristmasRotationDecision {
  mode: ChristmasMode
  playChristmas: boolean
  nextState: ChristmasRotationState
}

export function christmasModeForManilaTime(timestamp: number): ChristmasMode {
  const manila = new Date(timestamp + MANILA_OFFSET_MS)
  const month = manila.getUTCMonth()
  if (month === 8 || month === 9) return 'single'
  if (month === 10 || month === 11) return 'triple'
  return 'off'
}

export function planChristmasTrack(
  timestamp: number,
  state: ChristmasRotationState,
): ChristmasRotationDecision {
  const mode = christmasModeForManilaTime(timestamp)
  const regularTracksSinceChristmas = Math.max(0, Math.floor(state.regularTracksSinceChristmas))
  const christmasTracksRemaining = Math.max(0, Math.floor(state.christmasTracksRemaining))

  if (mode === 'off') {
    return { mode, playChristmas: false, nextState: { regularTracksSinceChristmas: 0, christmasTracksRemaining: 0 } }
  }

  if (christmasTracksRemaining > 0) {
    return {
      mode,
      playChristmas: true,
      nextState: { regularTracksSinceChristmas: 0, christmasTracksRemaining: christmasTracksRemaining - 1 },
    }
  }

  if (regularTracksSinceChristmas >= CHRISTMAS_REGULAR_TRACK_INTERVAL) {
    const burstLength = mode === 'triple' ? 3 : 1
    return {
      mode,
      playChristmas: true,
      nextState: { regularTracksSinceChristmas: 0, christmasTracksRemaining: burstLength - 1 },
    }
  }

  return {
    mode,
    playChristmas: false,
    nextState: { regularTracksSinceChristmas: regularTracksSinceChristmas + 1, christmasTracksRemaining: 0 },
  }
}
