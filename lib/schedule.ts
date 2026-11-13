export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

export const SIGN_OFF_HOUR = 1
export const SIGN_ON_HOUR = 4

export type ProgramId = 'sunday-oldies' | 'sunday-english' | 'sunday-english-oldies' | 'sunday-tagalog' | 'english-love' | 'disco' | 'news' | 'night-love' | 'love-mix' | 'off-air'

export type Language = 'english' | 'tagalog'

export interface Artist {
  name: string
  match: string
  language: Language
}

export interface Program {
  id: ProgramId
  pools: Record<Language, Artist[]>
  variants: Record<Language, string[]>
  tagalogOnly?: boolean
}

function artists(language: Language, entries: string[]): Artist[] {
  return entries.map((entry) => {
    const [name, match] = entry.split('|')
    return { name, match: (match ?? name).toLowerCase(), language }
  })
}

const PINOY_OLDIES = artists('tagalog', [
  'Imelda Papin',
  'Victor Wood',
  'Bing Rodrigo',
  'Eddie Peregrina',
  'Pilita Corrales',
  'Nora Aunor',
  'Rico J. Puno|rico j',
  'Didith Reyes',
  'Diomedes Maturan',
  'Tirso Cruz III|tirso cruz',
  'Eddie Mesa',
  'Claire dela Fuente|dela fuente',
  'Hajji Alejandro',
  'Basil Valdez',
  'Marco Sison',
  'Rey Valera',
  'Carmen Soriano',
  'Sylvia La Torre',
  'Ric Segreto',
  'Nonoy Zuniga|zuniga',
  'Celeste Legaspi',
  'Merci Molina',
  'Asin',
])

const PINOY_LOVE = artists('tagalog', [
  'Rey Valera',
  'Basil Valdez',
  'Martin Nievera',
  'Regine Velasquez|regine',
  'Gary Valenciano',
  'Ariel Rivera',
  'Ogie Alcasid',
  'Lea Salonga',
  'Kuh Ledesma',
  'Zsa Zsa Padilla',
  'Joey Albert',
  'Pops Fernandez',
  'Randy Santiago',
  'Vina Morales',
  'Janno Gibbs',
  'Raymond Lauchengco',
  'Rico J. Puno|rico j',
  'Hajji Alejandro',
  'Marco Sison',
  'Nonoy Zuniga|zuniga',
  'Gino Padilla',
  'Side A',
  'South Border',
  'Freestyle',
  'APO Hiking Society|apo hiking',
  'Sharon Cuneta',
  'Dingdong Avanzado',
  'Jessa Zaragoza',
  'Renz Verano',
  'Donna Cruz',
  'Roselle Nava',
  'Lani Misalucha',
  'Jamie Rivera',
  'Jaya',
  'Moira Dela Torre',
  'Sarah Geronimo',
  'Yeng Constantino',
  'Ben&Ben',
  'Zack Tabudlo',
])

const SUNDAY_ENGLISH_OLDIES = artists('english', [
  'Victor Wood',
  'Engelbert Humperdinck|engelbert',
  'Tom Jones',
  'Andy Williams',
  'Perry Como',
  'Elvis Presley',
  'Frank Sinatra',
  'Nat King Cole',
  'Bing Crosby',
])

const SUNDAY_TAGALOG_OLDIES = [
  ...artists('tagalog', [
  'Imelda Papin',
  'Claire dela Fuente|dela fuente',
  'Victor Wood',
  'Eddie Peregrina',
  'Pilita Corrales',
  'Nora Aunor',
  'Bing Rodrigo',
  'Diomedes Maturan',
  'Basil Valdez',
  'Marco Sison',
  'Rey Valera',
  ]),
  ...PINOY_OLDIES,
]

export const CHRISTMAS_ARTISTS: Record<Language, Artist[]> = {
  english: artists('english', [
    'Andy Williams', 'Nat King Cole', 'Bing Crosby', 'Brenda Lee', 'Frank Sinatra',
    'Carpenters', 'Elvis Presley', 'Perry Como', 'Jose Mari Chan',
  ]),
  tagalog: artists('tagalog', [
    'Jose Mari Chan', 'APO Hiking Society|apo hiking', 'Gary Valenciano',
    'Sharon Cuneta', 'Regine Velasquez|regine', 'Kuh Ledesma', 'Imelda Papin',
  ]),
}

const ENGLISH_LOVE = artists('english', [
  'Dan Hill',
  'Air Supply',
  'Lionel Richie',
  'Peter Cetera',
  'Bread',
  'Barry Manilow',
  'Michael Bolton',
  'Celine Dion',
  'Whitney Houston',
  'Phil Collins',
  'Kenny Rogers',
  'Carpenters',
  'Richard Marx',
  'Boyz II Men',
  'James Ingram',
  'Christopher Cross',
  'Billy Ocean',
  'England Dan & John Ford Coley|england dan',
  'Dionne Warwick',
  'Roberta Flack',
  'Engelbert Humperdinck|engelbert',
  'Lobo',
  'Bertie Higgins',
  'Stevie Wonder',
  'Mariah Carey',
  'Peabo Bryson',
  'Brian McKnight',
  'Lionel Richie',
])

const NIGHT_LOVE = artists('english', [
  'Natalie Cole',
  'Diana Ross',
  'Whitney Houston',
  'Anita Baker',
  'Luther Vandross',
  'Gladys Knight',
  'Dionne Warwick',
  'Carpenters',
  'Barbra Streisand',
  'Peabo Bryson',
  'Roberta Flack',
  'Patti Austin',
  'James Ingram',
  'Smokey Robinson',
  'Commodores',
  'George Benson',
  'Toni Braxton',
  'Mariah Carey',
  'Celine Dion',
  'Vanessa Williams',
  'Brian McKnight',
  'Atlantic Starr',
  'Air Supply',
  'Deniece Williams',
  'Lionel Richie',
  'Dan Hill',
])

const ENGLISH_DISCO = artists('english', [
  'Bee Gees',
  'Donna Summer',
  'ABBA',
  'Boney M',
  'Earth Wind and Fire|earth wind',
  'Kool and the Gang|kool',
  'Diana Ross',
  'Lionel Richie',
  'Stevie Wonder',
  'Michael Jackson',
  'Laura Branigan',
  'Commodores',
  'Olivia Newton-John',
])

const TAGALOG_DISCO = artists('tagalog', [
  'Rey Valera',
  'Basil Valdez',
  'Martin Nievera',
  'Sharon Cuneta',
  'Pops Fernandez',
  'Gary Valenciano',
  'Vina Morales',
  'Joey Albert',
  'Rico J. Puno|rico j',
])

const LOVE_VARIANTS = ['', 'official audio', 'lyrics', 'greatest hits', 'love song']
const OPM_VARIANTS = ['', 'official audio', 'lyrics', 'OPM', 'greatest hits']

export const PROGRAMS: Record<ProgramId, Program> = {
  'sunday-oldies': {
    id: 'sunday-oldies',
    pools: { english: SUNDAY_ENGLISH_OLDIES, tagalog: SUNDAY_TAGALOG_OLDIES },
    variants: { english: ['', 'oldies', 'classic hits'], tagalog: ['', 'official audio', 'OPM oldies'] },
  },
  'sunday-english': {
    id: 'sunday-english',
    pools: { english: [...ENGLISH_LOVE, ...NIGHT_LOVE], tagalog: [] },
    variants: { english: LOVE_VARIANTS, tagalog: [] },
  },
  'sunday-english-oldies': {
    id: 'sunday-english-oldies',
    pools: { english: SUNDAY_ENGLISH_OLDIES, tagalog: [] },
    variants: { english: ['', 'oldies', 'classic hits'], tagalog: [] },
  },
  'sunday-tagalog': {
    id: 'sunday-tagalog',
    pools: { english: [], tagalog: PINOY_LOVE },
    variants: { english: [], tagalog: OPM_VARIANTS },
    tagalogOnly: true,
  },
  'english-love': {
    id: 'english-love',
    pools: { english: ENGLISH_LOVE, tagalog: PINOY_LOVE },
    variants: { english: LOVE_VARIANTS, tagalog: OPM_VARIANTS },
  },
  disco: {
    id: 'disco',
    pools: { english: ENGLISH_DISCO, tagalog: TAGALOG_DISCO },
    variants: { english: ['', 'soft disco', 'classic hits', 'soul hits'], tagalog: ['', 'official audio', 'OPM love songs'] },
  },
  news: {
    id: 'news',
    pools: { english: [], tagalog: [] },
    variants: { english: [], tagalog: [] },
  },
  'night-love': {
    id: 'night-love',
    pools: { english: NIGHT_LOVE, tagalog: PINOY_LOVE },
    variants: { english: LOVE_VARIANTS, tagalog: OPM_VARIANTS },
  },
  'love-mix': {
    id: 'love-mix',
    pools: { english: [...ENGLISH_LOVE, ...NIGHT_LOVE], tagalog: PINOY_LOVE },
    variants: { english: LOVE_VARIANTS, tagalog: OPM_VARIANTS },
  },
  'off-air': {
    id: 'off-air',
    pools: { english: [], tagalog: [] },
    variants: { english: [], tagalog: [] },
  },
}

export interface ManilaTime {
  hour: number
  minute: number
  day: number
}

export function manilaTime(ms: number): ManilaTime {
  const d = new Date(ms + MANILA_OFFSET_MS)
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes(), day: d.getUTCDay() }
}

export function isOffAir(ms: number, signOffHour = SIGN_OFF_HOUR, signOnHour = SIGN_ON_HOUR): boolean {
  const { hour, day } = manilaTime(ms)
  if (day === 0) return false
  return signOffHour < signOnHour
    ? hour >= signOffHour && hour < signOnHour
    : hour >= signOffHour || hour < signOnHour
}

export function nextSignOn(ms: number, signOnHour = SIGN_ON_HOUR): number {
  const d = new Date(ms + MANILA_OFFSET_MS)
  d.setUTCHours(signOnHour, 0, 0, 0)
  let target = d.getTime() - MANILA_OFFSET_MS
  if (target <= ms) target += 24 * 60 * 60 * 1000
  return target
}

export function nextSignOff(ms: number, signOffHour = SIGN_OFF_HOUR): number {
  const d = new Date(ms + MANILA_OFFSET_MS)
  d.setUTCHours(signOffHour, 0, 0, 0)
  let target = d.getTime() - MANILA_OFFSET_MS
  if (target <= ms) target += 24 * 60 * 60 * 1000
  if (manilaTime(target).day === 0) target += 24 * 60 * 60 * 1000
  return target
}

/**
 * Sunday 1–4 AM: English favorites; 4–8 AM: English senior classics; 8–11 AM: Tagalog senior classics.
 * 11:01 AM–midnight: Tagalog favorites. Sunday runs continuously with no sign-off.
 * 4–7 PM (incl. the 7 o'clock hour): mellow classic pop, soft disco, and soul hits. 8 PM–12 AM: English & Tagalog love songs.
 * Every other on-air hour: English love songs mixed with Tagalog.
 */
export function programAt(ms: number, signOffHour = SIGN_OFF_HOUR, signOnHour = SIGN_ON_HOUR, discoStartHour = 16, discoEndHour = 20, newsEnabled = true): Program {
  const { hour, minute, day } = manilaTime(ms)
  if (isOffAir(ms, signOffHour, signOnHour)) return PROGRAMS['off-air']
  if (day === 0) {
    if (hour >= 4 && hour < 8) return PROGRAMS['sunday-english-oldies']
    if ((hour >= 8 && hour < 11) || (hour === 11 && minute === 0)) return PROGRAMS['sunday-oldies']
    if (hour > 11 || (hour === 11 && minute >= 1)) return PROGRAMS['sunday-tagalog']
    return PROGRAMS['sunday-english']
  }
  if (hour >= 10 && hour < 15) return PROGRAMS['english-love']
  if (newsEnabled && hour === 16 && minute < 50) return PROGRAMS.news
  const inDiscoWindow = discoStartHour < discoEndHour
    ? hour >= discoStartHour && hour < discoEndHour
    : hour >= discoStartHour || hour < discoEndHour
  if (inDiscoWindow) return PROGRAMS.disco
  if (hour >= 20) return PROGRAMS['night-love']
  return PROGRAMS['love-mix']
}

/** Rotation: 2 English, then 2 Tagalog, repeating. */
export function languageForSlot(program: Program, songCount: number): Language {
  if (program.id === 'sunday-english' || program.id === 'sunday-english-oldies') return 'english'
  if (program.tagalogOnly) return 'tagalog'
  return Math.floor(songCount / 2) % 2 === 0 ? 'english' : 'tagalog'
}

export function manilaMonth(ms: number): number {
  return new Date(ms + MANILA_OFFSET_MS).getUTCMonth() + 1
}

export function manilaMonthKey(ms: number): string {
  const date = new Date(ms + MANILA_OFFSET_MS)
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`
}

export function manilaDateKey(ms: number): string {
  const date = new Date(ms + MANILA_OFFSET_MS)
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
}

export function isNightVolumeWindow(ms: number, startHour: number, endHour: number): boolean {
  const { hour } = manilaTime(ms)
  return startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour
}

export function isGoldenSundayWindow(ms: number): boolean {
  const { hour, day } = manilaTime(ms)
  return day === 0 && hour >= 4 && hour < 13
}

/** Seasonal cadence: one Christmas song per five in Sep–Oct; three in a row in Nov; three of every four in Dec. */
export function isChristmasSlot(monthlySongIndex: number, ms: number): boolean {
  const month = manilaMonth(ms)
  if (month === 9 || month === 10) return monthlySongIndex % 5 === 4
  if (month === 11) return monthlySongIndex % 7 < 3
  if (month === 12) return monthlySongIndex % 4 < 3
  return false
}
