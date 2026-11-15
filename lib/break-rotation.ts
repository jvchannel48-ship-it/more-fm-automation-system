import type { AudioAsset } from './types'

export type BreakAudioKind = 'jingle' | 'golden-sunday'

export interface BreakAudioSpot {
  asset: AudioAsset
  kind: BreakAudioKind
}

export function selectSingleBreakAudio(input: {
  sundayGoldenBreak: boolean
  regularBreak: boolean
  jingleEnabled: boolean
  goldenSunday: AudioAsset | null
  jingle: AudioAsset | null
}): BreakAudioSpot | null {
  if (input.sundayGoldenBreak && input.goldenSunday) {
    return { asset: input.goldenSunday, kind: 'golden-sunday' }
  }
  if (input.regularBreak && input.jingleEnabled && input.jingle) {
    return { asset: input.jingle, kind: 'jingle' }
  }
  return null
}
