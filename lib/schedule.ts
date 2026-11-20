export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

export const SIGN_OFF_HOUR = 3
export const SIGN_ON_HOUR = 4
export const DZMM_STREAM_URL = 'https://us1.amfmph.com:8852/live'
export const LOVE_CONNECT_IDENT_DURATION_SECONDS = 6.191

export type ProgramId =
  | 'sunday-oldies'
  | 'sunday-english-oldies'
  | 'sunday-tagalog-classic'
  | 'sunday-english-love'
  | 'english-love'
  | 'daytime-love'
  | 'disco'
  | 'night-love'
  | 'love-mix'
  | 'masbate-tagalog'
  | 'off-air'

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
  englishOnly?: boolean
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

const SUNDAY_ENGLISH_OLDIES = artists('english', [
  'Bobby Vinton',
  'Victor Wood',
  'Jim Reeves',
  'Perry Como',
  'Andy Williams',
  'Nat King Cole',
  'Matt Monro',
  'Frank Sinatra',
  'Tom Jones',
  'Neil Sedaka',
  'Engelbert Humperdinck|engelbert',
  'Paul Anka',
])

const SUNDAY_TAGALOG_CLASSICS = artists('tagalog', [
  'Rodel Naval',
  'Renz Verano',
  'Lea Salonga|lea salonga',
  'Rey Valera',
  'Basil Valdez',
  'Ariel Rivera',
  'Martin Nievera',
  'Ogie Alcasid',
  'Joey Albert',
  'Rico J. Puno|rico j',
  'Marco Sison',
  'Nonoy Zuniga|zuniga',
  'Jessa Zaragoza',
  'Donna Cruz',
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
  'Willie Revillame|willie',
  'Yeng Constantino|yeng',
  'Jona|jona',
  'Morissette Amon|morissette',
  'Manilyn Reynes|manilyn',
  'Manilyn Santos|manilyn santos',
  'Ogie Alcasid|ogie',
  'MYMP',
  'Michael Learns to Rock|michael learns to rock',
  'December Avenue|december avenue',
  'Apo Hiking Society|apo hiking',
  'Freestyle',
  'Side A',
  'South Border',
  'Nina',
  'Kyla',
  'Juris',
  'Jay R|jay r',
  'Sarah Geronimo|sarah',
  'Aiza Seguerra|aiza',
  'KZ Tandingan|kz',
  'Jed Madela|jed madela',
  'Erik Santos|erik santos',
  'Kitchie Nadal|kitchie',
  'Yeng Constantino|yeng',
  'Moira Dela Torre|moira',
  'Ben&Ben|ben and ben',
  'December Avenue|december avenue',
  'Cup of Joe|cup of joe',
  'Lola Amour|lola amour',
])

export const NEW_TAGALOG_OPM_ARTISTS = artists('tagalog', [
  'Dionela',
  'Adie',
  'Zack Tabudlo',
  'Arthur Nery',
  'Moira Dela Torre',
  'TJ Monterde',
  'Janine Teñoso',
  'mrld',
  'Yeng Constantino|yeng',
  'Jona|jona',
  'Morissette Amon|morissette',
  'Willie Revillame|willie revillame',
])

export const NEW_TAGALOG_OPM_VARIANTS = [
  'new OPM love song',
  'modern OPM ballad',
  'soft Tagalog love song',
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
  'Michael Learns to Rock|michael learns to rock',
  'Chicago',
  'Bryan Adams|bryan adams',
  'Westlife',
  'Backstreet Boys|backstreet boys',
  'Boyzone',
  'Savage Garden|savage garden',
  'The Beatles|beatles',
  'Elton John|elton john',
  'Richard Marx|richard marx',
  'Ed Sheeran|ed sheeran',
  'Bruno Mars|bruno mars',
  'Adele',
  'Taylor Swift|taylor swift',
  'John Legend|john legend',
  'James Blunt|james blunt',
  'Jason Mraz|jason mraz',
  'Michael Buble|michael buble',
  'Justin Bieber|justin bieber',
  'Shawn Mendes|shawn mendes',
  'Sam Smith|sam smith',
  'One Direction|one direction',
  'Maroon 5|maroon 5',
  'Coldplay',
  'The Carpenters|carpenters',
  'Roxette',
  'Foreigner',
  'REO Speedwagon|reo speedwagon',
  'Toto',
  'Queen',
  'Eric Clapton|eric clapton',
  'Rod Stewart|rod stewart',
  'Kenny Loggins|kenny loggins',
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
  'Village People',
  'KC and the Sunshine Band|sunshine band',
  'Gloria Gaynor',
  'Earth Wind and Fire|earth wind',
  'Kool and the Gang|kool',
  'Sister Sledge',
  'Madonna',
  'Modern Talking',
  'Sandra',
  'C.C. Catch|catch',
  'Bad Boys Blue',
  'Michael Jackson',
  'Ace of Base',
  'La Bouche',
  'Real McCoy',
  'Haddaway',
  'Dr. Alban|alban',
  'Pet Shop Boys',
  'Rick Astley',
  'Samantha Fox',
  'Laura Branigan',
  'Eruption',
  'Whigfield',
  'Corona',
])

const TAGALOG_DISCO = artists('tagalog', [
  'VST & Company|vst',
  'Hotdog',
  'Sharon Cuneta',
  'Pops Fernandez',
  'Gary Valenciano',
  'Vina Morales',
  'Manilyn Reynes|manilyn',
  'Manilyn Santos|manilyn santos',
  'Jaya',
  'Andrew E|andrew e',
  'Rico J. Puno|rico j',
  'Willie Revillame|willie',
])

const LOVE_VARIANTS = ['60s 70s 80s 90s 2000s love songs', 'classic love ballad', 'soft ballad', 'easy listening', 'oldies love song', 'original audio']
const DISCO_VARIANTS = [
  '',
  'official audio',
  '80s eurodisco',
  'classic disco dance hit',
  'new 2026 dance hit',
  'latest 2026 disco pop song',
  '2026 dance music official audio',
]
const OPM_VARIANTS = ['classic OPM ballad', 'old OPM love song', 'easy listening OPM', 'original audio', 'greatest hits']
const SUNDAY_OLDIES_VARIANTS = ['Mr Lonely', 'classic English oldies', 'old English love songs', 'easy listening oldies']
const MASBATE_CURRENT_TAGALOG = artists('tagalog', [
  'BINI',
  'SB19',
  'Maki',
  'Cup of Joe',
  'Lola Amour',
  'Sunkissed Lola',
  'Hev Abi',
  'Flow G',
  'Kiyo',
])
const MASBATE_TAGALOG = [...PINOY_LOVE, ...NEW_TAGALOG_OPM_ARTISTS, ...MASBATE_CURRENT_TAGALOG]
const MASBATE_TAGALOG_VARIANTS = ['latest 2026 OPM Tagalog song', 'new Filipino love song', 'modern Tagalog song', 'official audio', 'original audio']

export const PROGRAMS: Record<ProgramId, Program> = {
  'sunday-oldies': {
    id: 'sunday-oldies',
    pools: { english: [], tagalog: PINOY_OLDIES },
    variants: { english: [], tagalog: ['', 'official audio', 'lyrics', 'greatest hits'] },
    tagalogOnly: true,
  },
  'sunday-english-oldies': {
    id: 'sunday-english-oldies',
    pools: { english: SUNDAY_ENGLISH_OLDIES, tagalog: [] },
    variants: { english: SUNDAY_OLDIES_VARIANTS, tagalog: [] },
    englishOnly: true,
  },
  'sunday-tagalog-classic': {
    id: 'sunday-tagalog-classic',
    pools: { english: [], tagalog: SUNDAY_TAGALOG_CLASSICS },
    variants: { english: [], tagalog: OPM_VARIANTS },
    tagalogOnly: true,
  },
  'sunday-english-love': {
    id: 'sunday-english-love',
    pools: { english: NIGHT_LOVE, tagalog: [] },
    variants: { english: LOVE_VARIANTS, tagalog: [] },
    englishOnly: true,
  },
  'english-love': {
    id: 'english-love',
    pools: { english: ENGLISH_LOVE, tagalog: [...PINOY_LOVE, ...NEW_TAGALOG_OPM_ARTISTS] },
    variants: { english: LOVE_VARIANTS, tagalog: OPM_VARIANTS },
  },
  'daytime-love': {
    id: 'daytime-love',
    pools: { english: [...ENGLISH_LOVE, ...NIGHT_LOVE], tagalog: [...PINOY_LOVE, ...NEW_TAGALOG_OPM_ARTISTS] },
    variants: { english: LOVE_VARIANTS, tagalog: OPM_VARIANTS },
  },
  disco: {
    id: 'disco',
    pools: { english: ENGLISH_DISCO, tagalog: TAGALOG_DISCO },
    variants: { english: DISCO_VARIANTS, tagalog: DISCO_VARIANTS },
  },
  'night-love': {
    id: 'night-love',
    pools: { english: NIGHT_LOVE, tagalog: [...PINOY_LOVE, ...NEW_TAGALOG_OPM_ARTISTS] },
    variants: { english: LOVE_VARIANTS, tagalog: OPM_VARIANTS },
  },
  'masbate-tagalog': {
    id: 'masbate-tagalog',
    pools: { english: [], tagalog: MASBATE_TAGALOG },
    variants: { english: [], tagalog: MASBATE_TAGALOG_VARIANTS },
    tagalogOnly: true,
  },
  'love-mix': {
    id: 'love-mix',
    pools: { english: [...ENGLISH_LOVE, ...NIGHT_LOVE], tagalog: [...PINOY_LOVE, ...NEW_TAGALOG_OPM_ARTISTS] },
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
  day: number
  minute: number
}

export interface DzmmWindow {
  startAt: number
  liveStartAt: number
  endAt: number
}

export function manilaTime(ms: number): ManilaTime {
  const d = new Date(ms + MANILA_OFFSET_MS)
  return { hour: d.getUTCHours(), day: d.getUTCDay(), minute: d.getUTCMinutes() }
}

/** Stable Manila calendar key used for once-per-day automation state. */
export function manilaDateKey(ms: number): string {
  return new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10)
}
export interface DailyAnnouncementSchedule {
  kind: 'weekday' | 'saturday'
  songsRequired: number
  availableFrom: number
  expiresAt: number
}

/** Weekdays use the new clip after 3 songs until 9:45 PM; Saturday uses the old clip after 5 songs. */
export function dailyAnnouncementScheduleAt(ms: number): DailyAnnouncementSchedule | null {
  const { day } = manilaTime(ms)
  if (day === 0) return null
  const localDayStart = new Date(ms + MANILA_OFFSET_MS)
  localDayStart.setUTCHours(0, 0, 0, 0)
  const dayStart = localDayStart.getTime() - MANILA_OFFSET_MS
  const availableFrom = dayStart + SIGN_ON_HOUR * 60 * 60 * 1000
  if (day >= 1 && day <= 5) {
    return {
      kind: 'weekday',
      songsRequired: 3,
      availableFrom,
      expiresAt: dayStart + 21 * 60 * 60 * 1000 + 45 * 60 * 1000,
    }
  }
  return {
    kind: 'saturday',
    songsRequired: 5,
    availableFrom,
    expiresAt: dayStart + 24 * 60 * 60 * 1000,
  }
}

/** Returns a scheduled DZMM window, or null when the station should play its own music. */
export function dzmmWindowAt(ms: number): DzmmWindow | null {
  const { hour, minute, day } = manilaTime(ms)
  if (day === 0) return null

  const localDayStart = new Date(ms + MANILA_OFFSET_MS)
  localDayStart.setUTCHours(0, 0, 0, 0)
  const dayStart = localDayStart.getTime() - MANILA_OFFSET_MS
  const minuteOfDay = hour * 60 + minute

  if (minuteOfDay >= 420 && minuteOfDay < 480) {
    const startAt = dayStart + 420 * 60_000
    return { startAt, liveStartAt: startAt, endAt: dayStart + 480 * 60_000 }
  }

  if (day >= 1 && day <= 6 && minuteOfDay >= 1110 && minuteOfDay < 1200) {
    const startAt = dayStart + 1110 * 60_000
    return { startAt, liveStartAt: startAt, endAt: dayStart + 1200 * 60_000 }
  }

  if (minuteOfDay >= 1320) {
    const endAt = day === 6 ? dayStart + 24 * 60 * 60_000 : dayStart + 27 * 60 * 60_000
    const startAt = dayStart + 1320 * 60_000
    return {
      startAt,
      liveStartAt: startAt + LOVE_CONNECT_IDENT_DURATION_SECONDS * 1000,
      endAt,
    }
  }

  if (minuteOfDay < 180) {
    if (day === 1) return null
    const startAt = dayStart - 120 * 60_000
    return {
      startAt,
      liveStartAt: startAt + LOVE_CONNECT_IDENT_DURATION_SECONDS * 1000,
      endAt: dayStart + 180 * 60_000,
    }
  }

  return null
}

export function isOffAir(ms: number): boolean {
  const { hour } = manilaTime(ms)
  return hour >= SIGN_OFF_HOUR && hour < SIGN_ON_HOUR
}

/** Off-air window for a regional station (Manila clock). Handles overnight windows (e.g. 22→4). */
export function isOffAirHours(ms: number, signOffHour: number, signOnHour: number): boolean {
  const { hour } = manilaTime(ms)
  if (signOffHour === signOnHour) return false
  if (signOffHour < signOnHour) return hour >= signOffHour && hour < signOnHour
  return hour >= signOffHour || hour < signOnHour
}

export function nextSignOn(ms: number): number {
  const d = new Date(ms + MANILA_OFFSET_MS)
  d.setUTCHours(SIGN_ON_HOUR, 0, 0, 0)
  let target = d.getTime() - MANILA_OFFSET_MS
  if (target <= ms) target += 24 * 60 * 60 * 1000
  return target
}

export function nextSignOnAtHour(ms: number, signOnHour: number): number {
  const d = new Date(ms + MANILA_OFFSET_MS)
  d.setUTCHours(signOnHour, 0, 0, 0)
  let target = d.getTime() - MANILA_OFFSET_MS
  if (target <= ms) target += 24 * 60 * 60 * 1000
  return target
}

/** Iloilo DZMM block only: 6:30 PM – 8:00 PM Manila (Mon–Sat). */
export function iloiloDzmmWindowAt(ms: number): DzmmWindow | null {
  const { hour, minute, day } = manilaTime(ms)
  if (day === 0) return null
  const localDayStart = new Date(ms + MANILA_OFFSET_MS)
  localDayStart.setUTCHours(0, 0, 0, 0)
  const dayStart = localDayStart.getTime() - MANILA_OFFSET_MS
  const minuteOfDay = hour * 60 + minute
  if (day >= 1 && day <= 6 && minuteOfDay >= 1110 && minuteOfDay < 1200) {
    const startAt = dayStart + 1110 * 60_000
    return { startAt, liveStartAt: startAt, endAt: dayStart + 1200 * 60_000 }
  }
  return null
}

/** RJ FM uses an all-day love-song format; DZMM windows are handled separately. */
export function programAt(ms: number, sundayScheduleEnabled = true): Program {
  const { hour, day } = manilaTime(ms)
  if (sundayScheduleEnabled && day === 0) {
    if (hour >= 4 && hour < 10) return PROGRAMS['sunday-english-oldies']
    if (hour >= 10 && hour < 15) return PROGRAMS['sunday-oldies']
    if (hour >= 15 && hour < 20) return PROGRAMS['sunday-tagalog-classic']
    if (hour >= 20) return PROGRAMS['sunday-english-love']
  }
  if (hour >= 4 && hour < 20) return PROGRAMS['daytime-love']
  return PROGRAMS['love-mix']
}

/** RJ FM Naga follows the Manila love-song format. */
export function nagaProgramAt(ms: number): Program {
  return programAt(ms)
}

/** RJ FM Masbate 103.9 is Tagalog-only and intentionally excludes Christmas programming. */
export function masbateProgramAt(_ms: number): Program {
  return PROGRAMS['masbate-tagalog']
}

/** Daytime love is English-first: 3 English songs, then 1 Tagalog love song. */
export function languageForSlot(program: Program, songCount: number): Language {
  if (program.tagalogOnly) return 'tagalog'
  if (program.englishOnly) return 'english'
  if (program.id === 'daytime-love') return songCount % 4 === 3 ? 'tagalog' : 'english'
  return Math.floor(songCount / 2) % 2 === 0 ? 'english' : 'tagalog'
}
