export type PlayerBackground = 'night' | 'ocean' | 'sunset'
export type VolumeIcon = 'speaker' | 'minimal' | 'waves'
export type VinylColor = 'silver' | 'gold' | 'blue' | 'red' | 'purple' | 'green'
/** DJ-style center visual */
export type PlayerStyle = 'vinyl' | 'headphones' | 'radio' | 'speakers'

export interface PlayerPreferences {
  compact: boolean
  showVolume: boolean
  showBorder: boolean
  background: PlayerBackground
  volumeIcon: VolumeIcon
  vinylColor: VinylColor
  playerStyle: PlayerStyle
}

export const PLAYER_PREFERENCES_KEY = 'morefm_player_preferences'
export const DEFAULT_PLAYER_PREFERENCES: PlayerPreferences = {
  compact: false,
  showVolume: true,
  showBorder: true,
  background: 'night',
  volumeIcon: 'speaker',
  vinylColor: 'gold',
  playerStyle: 'vinyl',
}

const COLORS: VinylColor[] = ['silver', 'gold', 'blue', 'red', 'purple', 'green']
const STYLES: PlayerStyle[] = ['vinyl', 'headphones', 'radio', 'speakers']

export function readPlayerPreferences(): PlayerPreferences {
  if (typeof window === 'undefined') return DEFAULT_PLAYER_PREFERENCES
  try {
    const raw = JSON.parse(window.localStorage.getItem(PLAYER_PREFERENCES_KEY) || '{}') as Partial<PlayerPreferences>
    return {
      compact: raw.compact === true,
      showVolume: raw.showVolume !== false,
      showBorder: raw.showBorder !== false,
      background: raw.background === 'ocean' || raw.background === 'sunset' ? raw.background : 'night',
      volumeIcon: raw.volumeIcon === 'minimal' || raw.volumeIcon === 'waves' ? raw.volumeIcon : 'speaker',
      vinylColor: COLORS.includes(raw.vinylColor as VinylColor) ? (raw.vinylColor as VinylColor) : 'gold',
      playerStyle: STYLES.includes(raw.playerStyle as PlayerStyle) ? (raw.playerStyle as PlayerStyle) : 'vinyl',
    }
  } catch {
    return DEFAULT_PLAYER_PREFERENCES
  }
}

export function savePlayerPreferences(next: PlayerPreferences) {
  try { window.localStorage.setItem(PLAYER_PREFERENCES_KEY, JSON.stringify(next)) } catch { /* storage may be blocked */ }
  window.dispatchEvent(new CustomEvent('morefm-player-preferences', { detail: next }))
}
