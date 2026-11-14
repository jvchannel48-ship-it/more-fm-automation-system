import assert from 'node:assert/strict'
import { hasBlacklistedTitle, isAllowedTrack, isOfficialArtistChannel } from '../lib/track-filter.ts'

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

assert.equal(isAllowedTrack({ title: 'Artist - Song (Official Audio)', channel: 'Fan Uploads' }, 'Artist'), true)
assert.equal(isAllowedTrack({ title: 'Artist - Song (Official Music Video)', channel: 'TV Network' }, 'Artist'), true)
assert.equal(isAllowedTrack({ title: 'Artist - Song Audio', channel: 'Random Uploads' }, 'Artist'), true)
assert.equal(isAllowedTrack({ title: 'Artist - Song', channel: 'Artist Official' }, 'Artist'), true)
assert.equal(isAllowedTrack({ title: 'Artist - Song', channel: 'Artist - Topic' }, 'Artist'), true)
assert.equal(isAllowedTrack({ title: 'Artist - Song', channel: 'Artist Fan Channel' }, 'Artist'), false)
assert.equal(isAllowedTrack({ title: 'Artist - Song', channel: 'TV Network' }, 'Artist'), false)
assert.equal(isAllowedTrack({ title: 'Artist - Song' }, 'Artist'), false)
assert.equal(isAllowedTrack({ title: 'Artist - Song (Official Audio)', live: true }, 'Artist'), false)
assert.equal(isOfficialArtistChannel('Artist Official', 'Artist'), true)
console.log('track-filter: blacklist, whitelist, official-channel, and live gates passed')
