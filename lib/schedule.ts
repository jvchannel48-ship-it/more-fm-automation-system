export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

export const SIGN_OFF_HOUR = 1
export const SIGN_ON_HOUR = 4

export type ProgramId = 'sunday-oldies' | 'sunday-english-oldies' | 'sunday-tagalog' | 'brigada-news' | 'english-love' | 'good-vibes' | 'disco' | 'news' | 'night-love' | 'love-mix' | 'off-air'

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
  'Freddie Aguilar',
  'Florante',
  'Sampaguita',
  'APO Hiking Society|apo hiking',
  'VST & Company|vst',
  'Jose Mari Chan',
  'Dulce',
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
  'Adele',
  'John Legend',
  'Sam Smith',
  'Norah Jones',
  'Sade',
  'Simply Red',
  'Chicago',
  'The Righteous Brothers',
  'The Corrs',
  'James Blunt',
  'Coldplay',
  'Jason Mraz',
  'Bruno Mars',
  'Taylor Swift',
  'Ed Sheeran',
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
  'Sade',
  'Simply Red',
  'Norah Jones',
  'John Legend',
  'Adele',
  'The Righteous Brothers',
  'Heart',
])

const SUNDAY_ENGLISH_OLDIES = artists('english', [
  'Victor Wood',
  'The Platters',
  'Elvis Presley',
  'Frank Sinatra',
  'Nat King Cole',
  'Dean Martin',
  'Perry Como',
  'Andy Williams',
  'Neil Sedaka',
  'Paul Anka',
  'The Carpenters',
  'The Everly Brothers',
  'The Righteous Brothers',
  'The Beatles',
  'The Monkees',
  'The Lettermen',
  'Bobby Vinton',
  'Connie Francis',
  'Brenda Lee',
  'Dionne Warwick',
  'Engelbert Humperdinck|engelbert',
  'Tom Jones',
  'Cliff Richard',
  'Johnny Mathis',
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

const GOOD_VIBES_ENGLISH = artists('english', [
  'Ava Max',
  'Dua Lipa',
  'Sia',
  'Katy Perry',
  'Lady Gaga',
  'Miley Cyrus',
  'Kelly Clarkson',
  'P!nk|pink',
  'OneRepublic',
  'Maroon 5|maroon five',
  'Bruno Mars',
  'Taylor Swift',
  'Ed Sheeran',
  'Harry Styles',
  'Shawn Mendes',
  'Jason Mraz',
  'The Script',
  'Imagine Dragons',
  'One Direction',
  'Ellie Goulding',
])

const LOVE_VARIANTS = ['', 'official audio', 'greatest hits', 'love song', 'soft pop', 'classic love song']
const GOOD_VIBES_VARIANTS = ['', 'official audio', 'pop hits', 'feel good hits', 'greatest hits']
const OPM_VARIANTS = ['', 'official audio', 'lyrics', 'OPM', 'greatest hits']

export const PROGRAMS: Record<ProgramId, Program> = {
  'sunday-oldies': {
    id: 'sunday-oldies',
    pools: { english: [], tagalog: SUNDAY_TAGALOG_OLDIES },
    variants: { english: [], tagalog: ['Tagalog oldies', 'classic OPM Tagalog', 'Filipino classics', 'OPM oldies 80s 90s'] },
    tagalogOnly: true,
  },
  'sunday-english-oldies': {
    id: 'sunday-english-oldies',
    pools: { english: SUNDAY_ENGLISH_OLDIES, tagalog: [] },
    variants: { english: ['', 'classic oldies', 'senior classics', 'golden oldies'], tagalog: [] },
  },
  'sunday-tagalog': {
    id: 'sunday-tagalog',
    pools: { english: [], tagalog: PINOY_LOVE },
    variants: { english: [], tagalog: OPM_VARIANTS },
    tagalogOnly: true,
  },
  'brigada-news': {
    id: 'brigada-news',
    pools: { english: [], tagalog: [] },
    variants: { english: [], tagalog: [] },
  },
  'english-love': {
    id: 'english-love',
    pools: { english: ENGLISH_LOVE, tagalog: PINOY_LOVE },
    variants: { english: LOVE_VARIANTS, tagalog: OPM_VARIANTS },
  },
  'good-vibes': {
    id: 'good-vibes',
    pools: { english: GOOD_VIBES_ENGLISH, tagalog: [] },
    variants: { english: GOOD_VIBES_VARIANTS, tagalog: [] },
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
 * Sunday runs continuously with Tagalog senior classics and no English-language music all day.
 * Other days follow the configured program schedule; the default station settings enforce Tagalog-only rotation.
 */
export function programAt(ms: number, signOffHour = SIGN_OFF_HOUR, signOnHour = SIGN_ON_HOUR, discoStartHour = 16, discoEndHour = 19, newsEnabled = true): Program {
  const { hour, minute, day } = manilaTime(ms)
  if (isOffAir(ms, signOffHour, signOnHour)) return PROGRAMS['off-air']
  if (day === 0 && hour >= 6 && hour < 7) return PROGRAMS['brigada-news']
  if (hour >= 17 && hour < 18) return PROGRAMS['brigada-news']
  if (day === 0 && hour >= 4 && hour < 6) return PROGRAMS['sunday-english-oldies']
  if (day === 0) return PROGRAMS['sunday-oldies']
  if (hour >= 10 && hour < 15) return PROGRAMS['english-love']
  // Disco programming is intentionally disabled; use the regular love mix.
  if (hour >= 22) return PROGRAMS['night-love']
  if (hour >= 21) return PROGRAMS['english-love']
  return PROGRAMS['love-mix']
}

/** Rotation: 2 English, then 2 Tagalog, repeating. */
export function languageForSlot(program: Program, songCount: number): Language {
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

export function isChristmasTitle(title: string): boolean {
  return /\b(?:christmas|xmas|pasko|santa(?:\s+claus|\s+baby)?|silent\s+night|jingle\s+bells?|holly|winter\s+wonderland|maligayang\s+pasko|himig\s+ng\s+pasko|sa\s+araw\s+ng\s+pasko|deck\s+the\s+halls|o\s+holy\s+night|joy\s+to\s+the\s+world|we\s+wish\s+you|let\s+it\s+snow|white\s+christmas|blue\s+christmas|last\s+christmas|merry\s+christmas|christmas\s+time|christmas\s+song|christmas\s+eve|rudolph|frosty\s+the\s+snowman|grinch|grandma\s+got\s+run\s+over\s+by\s+a\s+reindeer|reindeer|sleigh\s+ride|first\s+noel|feliz\s+navidad|silver\s+bells|little\s+drummer\s+boy|carol\s+of\s+the\s+bells|o\s+christmas\s+tree|have\s+yourself\s+a\s+merry\s+little\s+christmas|wonderful\s+christmastime|mary['’]?s\s+boy\s+child|hark\s+the\s+herald\s+angels\s+sing)\b/i.test(title)
}
