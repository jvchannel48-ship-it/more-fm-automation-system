export interface TrackFilterItem {
  title?: unknown
  channel?: unknown
  author?: unknown
  uploader?: unknown
  source?: unknown
  description?: unknown
  live?: unknown
  isLive?: unknown
}

// Block non-song results. Tag live/concert carefully so normal studio titles stay.
const BLACKLIST_TITLE_RULE = /(?:\(\s*live\s*\)|\[\s*live\s*\]|\blive\s*$|\blive\s+at\b|\blive\s+from\b|\blive\s+in\b|\blive\s+on\b|\blive\s+version\b|\blive\s+concert\b|\blive\s+performance\b|\blive\s+stream\b|\bconcert(?:\s+live|\s+version)?\b|\baraneta\b|\bmall\s+show\b|\bit['’]?s\s+showtime\b|\bshowtime\b|\basap\b|\beat\s+bulaga\b|\btv\s+patrol\b|\bperformance\b|\bstudio\s+version\b|\bguesting\b|\bkaraoke\b|\blyric\s+video\b|\bcover\b|\breaction\b|\bremix\b|\bre-?mix\b|\bdance\s+mix\b|\bdisco(?:\s+mix|\s+version)?\b|\bedm\b|\btechno\b|\btrance\b|\bdubstep\b|\brave\b|\bclub\s+mix\b|\brock\s+version\b|\bhard\s+rock\b|\bmetal\b|\bpunk\b|\bnews\s+(?:break|update|report)\b|\bbreaking\s+news\b|\btv\s+news\b|\bradio\s+news\b|\binterview\b|\bpodcast\b|\bvlog\b|\blivestream\b|\bsung\s+live\b|\bsinging\s+live\b)/i
const TV_CHANNEL_RULE = /\b(?:tv|television|network|channel|showtime|asap|eat\s+bulaga|tv\s+patrol|wish\s*107(?:[.]?5)?|wishclusive|fan(?:\s+page|\s+channel)?|karaoke|news)\b/i
const OFFICIAL_TITLE_RULE = /\bofficial(?:\s+[a-z0-9]+){0,3}\s+(?:audio|video)\b/i
const AUDIO_TITLE_RULE = /\baudio\b/i
const OFFICIAL_CHANNEL_RULE = /\b(?:official|vevo|topic)\b/i

function normalized(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function hasBlacklistedTitle(title: unknown) {
  return typeof title !== 'string' || BLACKLIST_TITLE_RULE.test(title)
}

export function hasWhitelistedTitle(title: unknown) {
  return typeof title === 'string' && (OFFICIAL_TITLE_RULE.test(title) || AUDIO_TITLE_RULE.test(title))
}

/**
 * A title without an explicit official/audio label is only accepted from a
 * channel that identifies itself as the artist's official channel or Topic/VEVO.
 */
export function isOfficialArtistChannel(channel: unknown, artist: string) {
  if (typeof channel !== 'string' || !channel.trim() || TV_CHANNEL_RULE.test(channel)) return false
  const channelText = normalized(channel)
  const artistText = normalized(artist)
  if (!artistText) return false
  const artistMatches = channelText === artistText
    || channelText.includes(`${artistText} official`)
    || channelText.includes(`${artistText} vevo`)
    || channelText.includes(`${artistText} topic`)
    || channelText.startsWith(`${artistText} `)
  return artistMatches && (OFFICIAL_CHANNEL_RULE.test(channel) || channelText === artistText)
}

export function isAllowedTrack(item: TrackFilterItem, artist = '') {
  const title = typeof item.title === 'string' ? item.title : ''
  if (hasBlacklistedTitle(title)) return false
  if (item.live === true || item.live === 'true' || item.isLive === true || item.isLive === 'true') return false
  if (hasWhitelistedTitle(title)) return true
  return isOfficialArtistChannel(item.channel, artist)
}

export const PLAYLIST_FILTER_DESCRIPTION = {
  blacklist: 'live, concert, remix, disco, dance mix, rock, metal, news, interview, TV shows, karaoke, cover, reaction, performance',
  whitelist: 'official audio, official music video, audio, or an official artist/VEVO/Topic channel when the title has no official label',
} as const
