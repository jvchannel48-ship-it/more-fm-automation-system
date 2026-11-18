export interface ArtistTrackCredit {
  name: string
  match: string
}

/** Non-original / synthetic / alternate performances — never auto-queue these. */
const AI_OR_NON_ORIGINAL_RULE =
  /\b(?:ai|a\.i\.|artificial intelligence|suno|udio|voice ?clon(?:e|ed)|deepfake|synthetic|generated|remake|re-?imagined|cover(?:ed)?|tribute|karaoke|remix(?:ed)?|re[ -]?mix|mash ?up|mashup|medley|parody|impersonat\w*|soundalike|bootleg|re-record(?:ed|ing)|instrumental only)\b/i

/**
 * Hard-blocked genres for RJ FM love rotation.
 * Intentionally does NOT match bare "pop" so classic love / soft pop still plays.
 */
const EXCLUDED_GENRE_RULE =
  /\b(?:rock(?:\s*and\s*roll|\s*n\s*roll)?|hard\s*rock|soft\s*rock|alt(?:ernate)?\s*rock|indie\s*rock|punk(?:\s*rock)?|metal|heavy\s*metal|thrash|grunge|emo|screamo|hardcore|headbang|dance(?:\s*hits?|\s*mix|\s*pop)?|eurodance|disco|funk(?:y)?|house(?:\s*music)?|techno|edm|electro(?:nic)?|trance|dubstep|drum\s*and\s*bass|dnb|hardstyle|reggaeton|hip[\s-]?hop|rap(?:ping)?|trap|drill|rave|club\s*banger)\b/i

/** Extra club / party terms that often appear without the word "dance". */
const CLASSIC_LOVE_EXCLUSION_RULE =
  /\b(?:club|party|boogie|groove|up\s?tempo|faster|extended\s*mix|clubmix|dancemix|housemix|dj\s*mix|nonstop\s*mix|fitness|workout|aerobics)\b/i

/** Live / concert / news / non-song media. */
const LIVE_CONCERT_NEWS_RULE =
  /\b(?:live\s*(?:at|from|in|performance|session|concert|version|on)|concert|tour|stadium|unplugged|acoustic\s*session|audience|crowd|interview|news|breaking\s*news|bulletin|podcast|spoken\s*word|speech|sermon|commentary)\b/i

const NON_MUSIC_OR_ALTERNATE_RULE =
  /\b(?:full album|nonstop|non-stop|reaction|tutorial|sped\s?up|slowed|nightcore|8d|reverb|bass\s?boost|playlist|compilation|1 hour|one hour|loop|ringtone|lesson|chords|sing-?along|with lyrics in|version by|rendition|trailer|ost\s*only|movie\s*scene)\b/i

const FOREIGN_RULE =
  /espa[nñ]ol|spanish|en español|portugu|italiano|fran[cç]ais|deutsch|german version|korean|k-?pop|japanese|j-?pop|chinese|mandarin|cantonese|thai|vietnam|indonesia|malay|hindi|bollywood|arabic|turkish|russian|bisaya|cebuano|ilocano|subtitulado|traducida|legendado|letra/i

const NON_LATIN = /[^\u0000-\u024F\u2000-\u206F\u20A0-\u20CF\u2100-\u214F]/

/** Built-in admin defaults — always applied even if settings.blockedGenres is empty. */
export const DEFAULT_BLOCKED_GENRES = [
  'rock',
  'dance',
  'disco',
  'remix',
  'metal',
  'punk',
  'hip hop',
  'rap',
  'edm',
  'techno',
  'house',
  'concert',
  'live',
  'news',
] as const

export const GENRE_BLOCK_PRESETS = [
  { id: 'rock', label: 'Rock' },
  { id: 'dance', label: 'Dance' },
  { id: 'disco', label: 'Disco' },
  { id: 'remix', label: 'Remix' },
  { id: 'metal', label: 'Metal' },
  { id: 'punk', label: 'Punk' },
  { id: 'hip hop', label: 'Hip-Hop' },
  { id: 'rap', label: 'Rap' },
  { id: 'edm', label: 'EDM' },
  { id: 'techno', label: 'Techno' },
  { id: 'house', label: 'House' },
  { id: 'concert', label: 'Concert' },
  { id: 'live', label: 'Live' },
  { id: 'news', label: 'News' },
] as const

/** Alias for older admin UI Strict classic love button. */
export const STRICT_CLASSIC_LOVE_GENRES = DEFAULT_BLOCKED_GENRES

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function hasArtistCreditAttribution(title: string, artist: ArtistTrackCredit) {
  const aliases = [...new Set([normalize(artist.match), normalize(artist.name)].filter(Boolean))]
  const creditSegments = title.split(/\s+(?:-|–|—|\|)\s+/).map(normalize)

  return creditSegments.some((segment) =>
    aliases.some((alias) => segment === alias || segment.startsWith(`${alias} `) || segment.startsWith(`the ${alias} `)),
  )
}

/** Title fails hard genre / media rules (independent of admin list). */
export function isBlockedByTitleRules(title: string) {
  if (!title || NON_LATIN.test(title)) return true
  const normalizedTitle = normalize(title)
  if (AI_OR_NON_ORIGINAL_RULE.test(title)) return true
  if (EXCLUDED_GENRE_RULE.test(title) || EXCLUDED_GENRE_RULE.test(normalizedTitle)) return true
  if (CLASSIC_LOVE_EXCLUSION_RULE.test(normalizedTitle)) return true
  if (LIVE_CONCERT_NEWS_RULE.test(title) || LIVE_CONCERT_NEWS_RULE.test(normalizedTitle)) return true
  if (NON_MUSIC_OR_ALTERNATE_RULE.test(title) || FOREIGN_RULE.test(title)) return true
  return false
}

/** Accept an original track only when the scheduled artist is credited and title is clean. */
export function isOriginalArtistTrack(title: string, artist: ArtistTrackCredit) {
  if (isBlockedByTitleRules(title)) return false
  return hasArtistCreditAttribution(title, artist)
}

/** Merge admin blocked genres with built-in defaults (deduped). */
export function effectiveBlockedGenres(adminBlocked: string[] | undefined | null) {
  const admin = Array.isArray(adminBlocked)
    ? adminBlocked.map((g) => normalize(g)).filter(Boolean)
    : []
  return [...new Set([...DEFAULT_BLOCKED_GENRES.map((g) => normalize(g)), ...admin])].slice(0, 40)
}

/** Word-boundary-ish match of blocked genre tokens against free text. */
export function matchesBlockedGenre(value: string, blockedGenres: string[]) {
  const normalized = ` ${normalize(value)} `
  if (!normalized.trim()) return false
  return blockedGenres.some((genre) => {
    const needle = normalize(genre)
    if (!needle) return false
    if (normalized.includes(` ${needle} `)) return true
    return normalized.startsWith(` ${needle} `) || normalized.endsWith(` ${needle} `)
  })
}

/**
 * Full allow check for auto-search / request candidates.
 * Blocks rock/dance/disco/remix/live/news + admin list + non-original titles.
 */
export function isAllowedStationTrack(input: {
  title: string
  artist?: string
  genre?: string
  blockedGenres?: string[]
}) {
  const haystack = [input.title, input.artist ?? '', input.genre ?? ''].join(' ')
  if (isBlockedByTitleRules(input.title)) return false
  if (isBlockedByTitleRules(haystack)) return false
  const blocked = effectiveBlockedGenres(input.blockedGenres)
  if (matchesBlockedGenre(haystack, blocked)) return false
  return true
}
