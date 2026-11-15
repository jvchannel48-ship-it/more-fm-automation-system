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

// Block non-song results: live, concert, TV, news, rock, dance, disco, remix.
const BLACKLIST_TITLE_RULE = /\b(?:live|concert|araneta|mall\s+show|it['’]?s\s+showtime|showtime|asap|eat\s+bulaga|tv\s+patrol|performance|studio\s+version|guesting|karaoke|lyric\s+video|cover|reaction|remix|re-?mix|dance\s+mix|disco|edm|techno|trance|dubstep|rave|club\s+mix|rock\s+version|hard\s+rock|metal|punk|news\s+(?:break|update|report)|breaking\s+news|tv\s+news|radio\s+news|interview|podcast|vlog|livestream|live\s+stream|live\s+performance|sung\s+live|singing\s+live|concert\s+version)\b/i
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
