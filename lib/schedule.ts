export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

export const SIGN_OFF_HOUR = 1
export const SIGN_ON_HOUR = 4

export type ProgramId = 'sunday-oldies' | 'english-love' | 'disco' | 'night-love' | 'love-mix' | 'off-air'

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
  'Jose Mari Chan',
  'Martin Nievera',
  'Regine Velasquez|regine',
  'Gary Valenciano',
  'Morissette|morissette',
  'Jona|jona',
  'Janine Berdin|janine berdin',
  'Sarah Geronimo|sarah geronimo',
  'Moira Dela Torre|moira',
  'KZ Tandingan|kz tandingan',
  'Daryl Ong|daryl ong',
  'Erik Santos|erik santos',
  'Jed Madela|jed madela',
  'Yeng Constantino|yeng constantino',
  'Zack Tabudlo|zack tabudlo',
  'Ben&Ben|ben and ben',
  'December Avenue|december avenue',
  'Rachelle Ann Go|rachelle ann go',
  'Aiza Seguerra|aiza',
  'Sarah G|sarah',
  'Toni Gonzaga|toni gonzaga',
  'Karylle|karylle',
  'Angeline Quinto|angeline quinto',
  'Julie Anne San Jose|julie anne',
  'Lovi Poe|lovi poe',
  'Sitti|sitti',
  'Freddie Aguilar|freddie aguilar',
  'Florante|florante',
  'Mike Hanopol|mike hanopol',
  'Wency Cornejo|wency cornejo',
  'Kamikazee|kamikazee',
  'Parokya ni Edgar|parokya',
  'Eraserheads|eraserheads',
  'Rivermaya|rivermaya',
  'Pupil|pupil',
  'Sponge Cola|sponge cola',
  'December Avenue|december avenue',
  'The Juans|the juans',
  'Cup of Joe|cup of joe',
  'Arthur Nery|arthur nery',
  'BINI|bini',
  'SB19|sb19',
  'G22|g22',
  'Alamat|alamat',
  'Tanya Markova|tanya markova',
  'Apo Hiking Society|apo hiking',
  'Imelda Papin|imelda papin',
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
])

const ENGLISH_LOVE = artists('english', [
  'Dan Hill',
  'Air Supply',
  'Taylor Swift|taylor swift',
  'Ed Sheeran|ed sheeran',
  'Adele|adele',
  'Bruno Mars|bruno mars',
  'Justin Bieber|justin bieber',
  'Beyonce|beyonce',
  'Rihanna|rihanna',
  'Lady Gaga|lady gaga',
  'Elton John|elton john',
  'The Beatles|beatles',
  'Frank Sinatra|frank sinatra',
  'Elvis Presley|elvis presley',
  'Dua Lipa|dua lipa',
  'Coldplay|coldplay',
  'Ariana Grande|ariana grande',
  'Kelly Clarkson|kelly clarkson',
  'Backstreet Boys|backstreet boys',
  'NSYNC|nsync',
  'Olivia Rodrigo|olivia rodrigo',
  'Billie Eilish|billie eilish',
  'The Weeknd|the weeknd',
  'Jason Mraz|jason mraz',
  'John Legend|john legend',
  'Michael Buble|michael buble',
  'Shawn Mendes|shawn mendes',
  'Sabrina Carpenter|sabrina carpenter',
  'Harry Styles|harry styles',
  'Alicia Keys|alicia keys',
  'P!nk|pink',
  'Katy Perry|katy perry',
  'Amy Winehouse|amy winehouse',
  'Madison Beer|madison beer',
  'Chappell Roan|chappell roan',
  'Laufey|laufey',
  'SZA|sza',
  'Mariah Carey|mariah carey',
  'Jose Mari Chan|jose mari chan',
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
  'Manilyn Reynes',
  'Jaya',
  'Andrew E',
  'Rico J. Puno|rico j',
])

const LOVE_VARIANTS = ['', 'official audio', 'lyrics', 'greatest hits', 'love song']
const OPM_VARIANTS = ['', 'official audio', 'lyrics', 'OPM', 'greatest hits']

export const PROGRAMS: Record<ProgramId, Program> = {
  'sunday-oldies': {
    id: 'sunday-oldies',
    pools: { english: [], tagalog: PINOY_OLDIES },
    variants: { english: [], tagalog: ['', 'official audio', 'lyrics', 'greatest hits'] },
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
    variants: { english: ['', 'official audio', 'hits', 'official video'], tagalog: ['', 'official audio', 'disco'] },
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
  day: number
}

export function manilaTime(ms: number): ManilaTime {
  const d = new Date(ms + MANILA_OFFSET_MS)
  return { hour: d.getUTCHours(), day: d.getUTCDay() }
}

export function isOffAir(ms: number): boolean {
  const { hour } = manilaTime(ms)
  return hour >= SIGN_OFF_HOUR && hour < SIGN_ON_HOUR
}

export function nextSignOn(ms: number): number {
  const d = new Date(ms + MANILA_OFFSET_MS)
  d.setUTCHours(SIGN_ON_HOUR, 0, 0, 0)
  let target = d.getTime() - MANILA_OFFSET_MS
  if (target <= ms) target += 24 * 60 * 60 * 1000
  return target
}

/**
 * Sunday 4–9 AM: old OPM for seniors. 10 AM–3 PM: English love songs.
 * 4–7 PM (incl. the 7 o'clock hour): disco hits. 8 PM–12 AM: English & Tagalog love songs.
 * Every other on-air hour: English love songs mixed with Tagalog.
 */
export function programAt(ms: number): Program {
  const { hour, day } = manilaTime(ms)
  if (hour >= SIGN_OFF_HOUR && hour < SIGN_ON_HOUR) return PROGRAMS['off-air']
  if (day === 0 && hour >= 4 && hour < 9) return PROGRAMS['sunday-oldies']
  if (hour >= 10 && hour < 15) return PROGRAMS['english-love']
  if (hour >= 16 && hour < 20) return PROGRAMS.disco
  if (hour >= 20) return PROGRAMS['night-love']
  return PROGRAMS['love-mix']
}

/** Rotation: 2 English, then 2 Tagalog, repeating. */
export function languageForSlot(program: Program, songCount: number): Language {
  if (program.tagalogOnly) return 'tagalog'
  return Math.floor(songCount / 2) % 2 === 0 ? 'english' : 'tagalog'
}


/** YS FM 107.1 dynamic time-check voice script (Philippine local time). */
export function ysFmTimeCheckPrompt(ms: number = Date.now()): string {
  const time = new Date(ms).toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila',
  })
  return `107.1 YS FM TIME CHECK! IT IS NOW ${time}. YOU'RE LISTENING TO YOUR FAVORITE SONGS, HOME OF ROMANTIC MUSIC, ONLINE RADIO STREAMING.`
}
