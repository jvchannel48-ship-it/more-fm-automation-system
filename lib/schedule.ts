export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

export const SIGN_OFF_HOUR = 4
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

/** Curated soft-pop / easy-listening artist discovery pools by era.
 * Search results still pass RJ FM's original-artist and no-rock/dance/disco/remix/AI filters.
 */
export const RJFM_ARTIST_LIBRARY: Record<string, Artist[]> = {
  '60s-70s': artists('english', [
    'Andy Williams', 'Nat King Cole', 'Perry Como', 'Matt Monro', 'Jim Reeves',
    'Frank Sinatra', 'Tony Bennett', 'Johnny Mathis', 'Dusty Springfield',
    'Dionne Warwick', 'Roberta Flack', 'Paul Anka', 'Tom Jones',
    'Engelbert Humperdinck|engelbert', 'Bobby Vinton', 'The Carpenters|carpenters',
    'Bread', 'Barry Manilow', 'Anne Murray', 'Rita Coolidge', 'Glen Campbell',
    'B.J. Thomas|bj thomas', 'The Righteous Brothers|righteous brothers',
  ]),
  '80s-90s': artists('english', [
    'Sade', 'Anita Baker', 'Luther Vandross', 'Peabo Bryson', 'James Ingram',
    'Richard Marx', 'Michael Bolton', 'Whitney Houston', 'Celine Dion',
    'Mariah Carey', 'Boyz II Men|boyz ii men', 'All-4-One|all 4 one',
    'Toni Braxton', 'Vanessa Williams', 'Brian McKnight', 'Shai',
    'Color Me Badd|color me badd', 'George Michael', 'Gloria Estefan',
    'Natalie Cole', 'Kenny G', 'Sarah McLachlan', 'Seal', 'Savage Garden|savage garden',
  ]),
  '2000s': artists('english', [
    'Westlife', 'Blue', 'Ronan Keating', 'Daniel Bedingfield',
    'James Blunt', 'Jason Mraz', 'John Legend', 'Alicia Keys',
    'Leona Lewis', 'Dido', 'Norah Jones', 'Michael Buble|michael buble',
    'Josh Groban', 'Sara Bareilles', 'Colbie Caillat', 'Corinne Bailey Rae',
    'Natasha Bedingfield', 'David Archuleta', 'Kelly Clarkson',
    'Daniel Powter', 'Gavin DeGraw', 'Jordin Sparks', 'David Cook',
  ]),
  '2023-2026': artists('english', [
    'Benson Boone', 'Teddy Swims', 'Alex Warren', 'Stephen Sanchez',
    'Laufey', 'Gracie Abrams', 'Olivia Dean', 'Lizzy McAlpine',
    'Lewis Capaldi', 'Dean Lewis', 'James Arthur', 'NIKI',
    'Sabrina Carpenter', 'Myles Smith', 'sombr', 'd4vd',
  ]),
  'OPM 60s-90s': artists('tagalog', [
    'Jose Mari Chan|jose mari chan', 'Pilita Corrales', 'Imelda Papin',
    'Victor Wood', 'Eddie Peregrina', 'Basil Valdez', 'Rey Valera',
    'Marco Sison', 'Rico J. Puno|rico j', 'Hajji Alejandro',
    'Nonoy Zuniga|zuniga', 'Celeste Legaspi', 'Rodel Naval',
    'Joey Albert', 'Gino Padilla', 'Raymond Lauchengco',
    'Ogie Alcasid|ogie', 'Gary Valenciano|gary v', 'Lea Salonga',
    'Sharon Cuneta', 'Jaya', 'Zsa Zsa Padilla',
  ]),
  'OPM 2000s-2026': artists('tagalog', [
    'Nina', 'Kyla', 'Juris', 'Jay R|jay r', 'Sarah Geronimo|sarah',
    'Erik Santos|erik santos', 'Jed Madela|jed madela', 'KZ Tandingan|kz',
    'Moira Dela Torre|moira', 'TJ Monterde', 'Arthur Nery',
    'Zack Tabudlo', 'Adie', 'Dionela', 'Maki', 'Cup of Joe',
    'Earl Agustin', 'Rob Deniel', 'Jan Roberts', 'Mikee Sarmiento',
    'LU', 'Lyka Estrella', 'Marielle Montellano', 'Trisha Puso', 'Mariah Deborah', 'Thea Astley',
    'Morissette Amon|morissette', 'Jona|jona', 'Angeline Quinto',
  ]),
}
const ENGLISH_ERA_EXPANSION = [
  ...RJFM_ARTIST_LIBRARY['60s-70s'],
  ...RJFM_ARTIST_LIBRARY['80s-90s'],
  ...RJFM_ARTIST_LIBRARY['2023-2026'],
]
const TAGALOG_ERA_EXPANSION = [
  ...RJFM_ARTIST_LIBRARY['OPM 60s-90s'],
  ...RJFM_ARTIST_LIBRARY['OPM 2000s-2026'],
]

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
  'Imelda Papin',
  'Victor Wood',
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
  'Cup of Joe|cup of joe',
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

const ENGLISH_OLDIES_AND_2026 = [
  ...RJFM_ARTIST_LIBRARY['60s-70s'], ...RJFM_ARTIST_LIBRARY['80s-90s'], ...RJFM_ARTIST_LIBRARY['2023-2026'],
]
const TAGALOG_OLDIES_AND_2026 = [...RJFM_ARTIST_LIBRARY['OPM 60s-90s'], ...NEW_TAGALOG_OPM_ARTISTS]


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

const LOVE_VARIANTS = ['60s 70s 80s 90s classic oldies love song ballad', 'classic oldies romantic love ballad official audio', '2026 new soft pop love song ballad official audio', '2026 latest romantic love ballad official audio', '2026 easy listening love song official audio', 'oldies love song original artist', '2026 soft romantic ballad original artist']
const DISCO_VARIANTS = [
  '',
  'official audio',
  '80s eurodisco',
  'classic disco dance hit',
  'new 2026 dance hit',
  'latest 2026 disco pop song',
  '2026 dance music official audio',
]
const OPM_VARIANTS = ['classic OPM oldies love song ballad', 'old Filipino romantic love song original artist', '2026 new OPM love song ballad official audio', '2026 latest Tagalog romantic ballad official audio', '2026 soft Filipino love song original artist']
const SUNDAY_OLDIES_VARIANTS = ['classic English oldies love song ballad', 'old English romantic love song original artist', '60s 70s classic oldies love songs']
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
const MASBATE_TAGALOG = [...PINOY_OLDIES, ...RJFM_ARTIST_LIBRARY['OPM 60s-90s'], ...NEW_TAGALOG_OPM_ARTISTS]
const MASBATE_TAGALOG_VARIANTS = ['classic OPM oldies love song ballad', '2026 latest Tagalog love song ballad official audio', '2026 new Filipino romantic ballad original artist']

const APPROVED_ENGLISH_SOFT_POOL = [
  ...ENGLISH_OLDIES_AND_2026,
  ...ENGLISH_LOVE,
  ...NIGHT_LOVE,
]

const ENGLISH_SOFT_VARIANTS = [
  'classic English oldies soft love song ballad official audio',
  'easy listening mellow romantic pop ballad original artist',
  'soft adult contemporary love song official audio',
  'classic 60s 70s 80s 90s English romantic ballad',
  '2026 latest English soft pop love ballad official audio',
  '2026 new mellow English love song original artist',
]

function englishOnlyProgram(id: ProgramId): Program {
  return {
    id,
    pools: { english: APPROVED_ENGLISH_SOFT_POOL, tagalog: [] },
    variants: { english: ENGLISH_SOFT_VARIANTS, tagalog: [] },
    englishOnly: true,
  }
}

const PINoy_OLDIES_SAFE = [...PINOY_OLDIES, ...RJFM_ARTIST_LIBRARY['OPM 60s-90s'], ...NEW_TAGALOG_OPM_ARTISTS]
function tagalogProgram(id: ProgramId, pool: Artist[] = TAGALOG_OLDIES_AND_2026, variants: string[] = OPM_VARIANTS): Program {
  return { id, pools: { english: [], tagalog: pool }, variants: { english: [], tagalog: variants }, tagalogOnly: true }
}

function mixedProgram(id: ProgramId): Program {
  return {
    id,
    pools: { english: APPROVED_ENGLISH_SOFT_POOL, tagalog: [...TAGALOG_OLDIES_AND_2026, ...PINOY_LOVE] },
    variants: { english: ENGLISH_SOFT_VARIANTS, tagalog: OPM_VARIANTS },
  }
}

export const PROGRAMS: Record<ProgramId, Program> = {
  'sunday-oldies': tagalogProgram('sunday-oldies', [...PINoy_OLDIES_SAFE]),
  'sunday-english-oldies': tagalogProgram('sunday-english-oldies'),
  'sunday-tagalog-classic': tagalogProgram('sunday-tagalog-classic', [...PINoy_OLDIES_SAFE, ...SUNDAY_TAGALOG_CLASSICS]),
  'sunday-english-love': tagalogProgram('sunday-english-love', PINOY_LOVE, OPM_VARIANTS),
  'english-love': mixedProgram('english-love'),
  'daytime-love': mixedProgram('daytime-love'),
  disco: mixedProgram('disco'),
  'night-love': mixedProgram('night-love'),
  'masbate-tagalog': tagalogProgram('masbate-tagalog', MASBATE_TAGALOG, MASBATE_TAGALOG_VARIANTS),
  'love-mix': mixedProgram('love-mix'),
  'off-air': { id: 'off-air', pools: { english: [], tagalog: [] }, variants: { english: [], tagalog: [] }, englishOnly: true },
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

/** Legacy compatibility: RJ FM now runs its own automated music continuously. */
export function dzmmWindowAt(_ms: number): DzmmWindow | null {
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

/** Legacy compatibility: no external DZMM handoff is scheduled. */
export function iloiloDzmmWindowAt(_ms: number): DzmmWindow | null {
  return null
}

/** RJ FM weekly AutoDJ format, using Philippine local time. */
export function programAt(ms: number, sundayScheduleEnabled = true, station: string = 'main'): Program {
  const { hour, minute, day } = manilaTime(ms)
  const minuteOfDay = hour * 60 + minute

  // Sunday is Tagalog OPM only, all day and all night. No English tracks.
  if (day === 0) return PROGRAMS['sunday-tagalog-classic']

  // Saturday follows the Filipino oldies format; late evening leans into
  // classic OPM love songs featuring Rodel Naval, April Boy and peers.
  if (day === 6) {
    if (minuteOfDay >= 22 * 60) return PROGRAMS['sunday-english-love']
    return PROGRAMS['sunday-tagalog-classic']
  }

  // Monday-Friday: English soft love songs with regular Tagalog OPM inserts.
  if (minuteOfDay >= 22 * 60) return PROGRAMS['night-love']
  return PROGRAMS['daytime-love']
}

/** RJ FM Naga follows the Manila love-song format. */
export function nagaProgramAt(ms: number): Program {
  return programAt(ms)
}

/** RJ FM Masbate 103.9 is Tagalog-only and intentionally excludes Christmas programming. */
export function masbateProgramAt(_ms: number): Program {
  return PROGRAMS['masbate-tagalog']
}

/** Weekday rotation: three English love songs followed by one Tagalog OPM song. */
export function languageForSlot(program: Program, songCount: number): Language {
  if (program.tagalogOnly) return 'tagalog'
  if (program.englishOnly) return 'english'
  return songCount % 4 === 3 ? 'tagalog' : 'english'
}
