export interface ArtistTrackCredit {
  name: string
  match: string
}

const AI_OR_NON_ORIGINAL_RULE =
  /\b(?:ai|a\.i\.|artificial intelligence|suno|udio|voice ?clon(?:e|ed)|deepfake|synthetic|generated|remake|re-?imagined|cover(?:ed)?|tribute|karaoke|remix(?:ed)?|re[ -]?mix|mashup|medley|parody|impersonat\w*|soundalike|bootleg|re-record(?:ed|ing))\b/i

const EXCLUDED_GENRE_RULE =
  /\b(?:dance|dances|danced|dancing|dance hits?|dance[ -]?pop|eurodance|disco|pop|rock|metal|punk|grunge|emo|screamo|hardcore|headbang)\b/i

// Classic-love playlists use a second, broader guard because many dance tracks
// do not contain the words "pop" or "dance" in their titles.
const CLASSIC_LOVE_EXCLUSION_RULE =
  /\b(?:club|party|funk\w*|groov\w*|boogie|house|techno|edm|electro|electronic|trance|dubstep|drum and bass|hardstyle|up ?tempo|fast(?:er)?|extended|mix|edit|clubmix|dancemix|housemix)\b/i

export const STRICT_CLASSIC_LOVE_GENRES = [
  'pop', 'dance', 'disco', 'rock', 'metal', 'punk', 'grunge', 'club', 'party',
  'funk', 'groove', 'boogie', 'house', 'techno', 'edm', 'electro', 'trance',
  'dubstep', 'remix', 'cover', 'karaoke', 'ai',
] as const

const NON_MUSIC_OR_ALTERNATE_RULE =
  /\b(?:full album|nonstop|non-stop|reaction|tutorial|sped ?up|slowed|nightcore|8d|reverb|bass ?boost|playlist|compilation|1 hour|loop|ringtone|lesson|chords|sing-?along|with lyrics in|version by|rendition)\b/i

const FOREIGN_RULE =
  /espa[nñ]ol|spanish|en español|portugu|italiano|fran[cç]ais|deutsch|german version|korean|k-?pop|japanese|j-?pop|chinese|mandarin|cantonese|thai|vietnam|indonesia|malay|hindi|bollywood|arabic|turkish|russian|bisaya|cebuano|ilocano|subtitulado|traducida|legendado|letra/i

const NON_LATIN = /[^\u0000-\u024F\u2000-\u206F\u20A0-\u20CF\u2100-\u214F]/

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

/** Accept an original track only when the scheduled artist is credited in the title. */
export function isOriginalArtistTrack(title: string, artist: ArtistTrackCredit) {
  if (!title || NON_LATIN.test(title)) return false
  const normalizedTitle = normalize(title)
  if (AI_OR_NON_ORIGINAL_RULE.test(title) || EXCLUDED_GENRE_RULE.test(title)) return false
  if (CLASSIC_LOVE_EXCLUSION_RULE.test(normalizedTitle)) return false
  if (NON_MUSIC_OR_ALTERNATE_RULE.test(title) || FOREIGN_RULE.test(title)) return false
  return hasArtistCreditAttribution(title, artist)
}
