import assert from 'node:assert/strict'
import { hasBlacklistedTitle, hasRejectedContent, isAllowedTrack, isOfficialArtistChannel } from '../lib/track-filter.ts'

// Matches the production blacklist in lib/track-filter.ts
for (const title of [
  'Artist - Song (Live)',
  'Artist - Song Concert',
  'Artist - Song at Araneta',
  'Artist - Song Mall Show',
  "Artist - Song It's Showtime",
  'Artist - Song ASAP',
  'Artist - Song Eat Bulaga',
  'Artist - Song TV Patrol',
  'Artist - Song Performance',
  'Artist - Song Studio Version',
  'Artist - Song Guesting',
  'Artist - Song Karaoke',
  'Artist - Song Lyric Video',
  'Artist - Song Cover',
  'Artist - Song Reaction',
]) assert.equal(hasBlacklistedTitle(title), true, `blacklist must reject ${title}`)

// Clean studio titles must pass the blacklist gate
for (const title of [
  'Rey Valera - Kung Kailangan Mo Ako',
  'Artist - Song (Official Audio)',
  'Side A - Forevermore',
]) assert.equal(hasBlacklistedTitle(title), false, `blacklist must allow ${title}`)

assert.equal(isAllowedTrack({ title: 'Artist - Song (Official Audio)', channel: 'Fan Uploads' }, 'Artist'), true)
assert.equal(isAllowedTrack({ title: 'Artist - Song (Official Music Video)', channel: 'TV Network' }, 'Artist'), true)
assert.equal(isAllowedTrack({ title: 'Artist - Song (Official HD Video)', channel: null }, 'Artist'), true)
assert.equal(isAllowedTrack({ title: 'Artist - Song Audio', channel: 'Random Uploads' }, 'Artist'), true)
assert.equal(isAllowedTrack({ title: 'Artist - Song', channel: 'Artist Official' }, 'Artist'), true)
assert.equal(isAllowedTrack({ title: 'Artist - Song', channel: 'Artist - Topic' }, 'Artist'), true)
assert.equal(isAllowedTrack({ title: 'Artist - Song', channel: 'Artist Fan Channel' }, 'Artist'), false)
assert.equal(isAllowedTrack({ title: 'Artist - Song', channel: 'TV Network' }, 'Artist'), false)
assert.equal(isAllowedTrack({ title: 'Artist - Song', channel: 'Random Uploads' }, 'Artist', true), true, 'exact title/artist matches may come from an unrecognized non-TV channel')
assert.equal(isAllowedTrack({ title: 'Artist - Song', channel: 'Independent Uploads' }, 'Artist', true), true, 'an exact title/artist match is independent of unrecognized non-TV uploader labels')
assert.equal(isAllowedTrack({ title: 'Artist - Song', channel: 'Fan Channel' }, 'Artist', true), false, 'exact matches still respect the fan/TV-channel rejection gate')
assert.equal(isAllowedTrack({ title: 'Artist - Song (Live Concert)', channel: 'Random Uploads' }, 'Artist', true), false, 'exact title/artist matching does not bypass blacklisted content')
assert.equal(isAllowedTrack({ title: 'Artist - Song', channel: 'TV Network' }, 'Artist', true), false, 'exact title/artist matching does not bypass TV-channel filtering')
assert.equal(isAllowedTrack({ title: 'Artist - Song' }, 'Artist'), false)
assert.equal(isAllowedTrack({ title: 'Artist - Song (Official Audio)', live: true }, 'Artist'), false)
for (const value of [
  'Artist - Song Karaoke Version',
  'Artist - Song Live Concert',
  'Artist - Song Live Performance',
  'It\'s Showtime official channel',
  'Wishclusive live session',
]) assert.equal(hasRejectedContent(value), true, `content filter must reject ${value}`)
assert.equal(isAllowedTrack({ title: 'Artist - Song (Official Audio)', channel: 'Artist Official', description: 'Live concert recording' }, 'Artist'), false)
assert.equal(isAllowedTrack({ title: 'Artist - Song (Official Audio)', channel: 'Artist Official', description: 'studio audio' }, 'Artist'), true)
assert.equal(isOfficialArtistChannel('Artist Official', 'Artist'), true)
console.log('track-filter: blacklist, whitelist, metadata, official-channel, and live gates passed')
