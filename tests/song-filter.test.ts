import assert from 'node:assert/strict'
import { isAllowedStationTrack, isBlockedByTitleRules, isBlockedProgramGenre, isOriginalArtistTrack } from '../lib/song-filter.ts'
import { PROGRAMS } from '../lib/schedule.ts'

assert.equal(isBlockedProgramGenre(PROGRAMS.disco.id, ['disco']), true, 'an explicit disco filter blocks the complete disco program')
assert.equal(isBlockedProgramGenre(PROGRAMS.disco.id, ['dance']), true, 'a dance filter also blocks the complete disco program')

const whitney = { name: 'Whitney Houston', match: 'Whitney Houston' }
const dionela = { name: 'Dionela', match: 'dionela' }

assert.equal(
  isOriginalArtistTrack('Whitney Houston - I Look to You (Official HD Video)', whitney),
  true,
  'an original track credited to the artist is allowed',
)
assert.equal(
  isOriginalArtistTrack('I Will Always Love You - Whitney Houston (Official Audio)', whitney),
  true,
  'a song title followed by the original artist credit is allowed',
)
assert.equal(
  isOriginalArtistTrack('Dionela - Marilag (Official Lyric Video)', dionela),
  true,
  'Dionela Marilag original is eligible for the new Tagalog OPM feature',
)
assert.equal(
  isOriginalArtistTrack('Whitney Houston - I Wanna Dance With Somebody', whitney, { allowDancePop: true }),
  false,
  'dance tracks are blocked even when legacy allowDancePop is requested',
)
assert.equal(
  isOriginalArtistTrack("Modern Talking - You're My Heart, You're My Soul (Official Audio)", { name: 'Modern Talking', match: 'modern talking' }, { allowDancePop: true }),
  true,
  'clean original track with no blocked genre token remains eligible',
)

for (const title of [
  'Whitney Houston - I Wanna Dance With Somebody',
  'Whitney Houston - Rock the Night',
  'Whitney Houston - I Look to You (Club Remix)',
  'Whitney Houston - I Look to You (Cover by Jane Doe)',
  'Whitney Houston - I Look to You (Tribute)',
  'Calum Scott, Whitney Houston - I Wanna Dance With Somebody',
  'Someone Else - Cover of Whitney Houston',
  'Whitney Houston - Canción en español',
  'Whitney Houston - AI-generated version',
  'Whitney Houston - Club Nights',
  'Whitney Houston - Saturday Party',
  'Whitney Houston - Funky Love',
  'Whitney Houston - Midnight Groove',
  'Whitney Houston - Boogie On',
  'Whitney Houston - House of Love',
  'Whitney Houston - Electronic Dreams',
  'Whitney Houston - Love Song (Extended Mix)',
  'Whitney Houston - I Look to You [Radio Edit]',
  'Whitney Houston - Dance_Mix',
  'Whitney Houston - AI cover generated with Suno',
  'Whitney Houston - Disco Inferno',
  'Whitney Houston - Eurodance Classics',
  'Whitney Houston - Club Dance Version',
]) {
  assert.equal(isOriginalArtistTrack(title, whitney), false, `excluded: ${title}`)
}

assert.equal(
  isOriginalArtistTrack('Whitney Houston - Pop Goes the World', whitney),
  true,
  'the word pop alone is not a blocked genre; soft-pop discovery remains eligible',
)
assert.equal(
  isOriginalArtistTrack('Whitney Houston - Saving All My Love for You (Official Audio)', whitney),
  true,
  'a classic ballad remains eligible',
)
assert.equal(isBlockedByTitleRules('Whitney Houston - Christmas Worship'), true, 'seasonal worship tracks stay blocked on standard stations')
assert.equal(isBlockedByTitleRules('Whitney Houston - I Wanna Dance With Somebody', { allowDancePop: true }), true, 'dance remains blocked for every program')

assert.equal(isAllowedStationTrack({ title: 'Whitney Houston - Saving All My Love for You', artist: 'Whitney Houston', genre: 'Disco Dance Remix', blockedGenres: [] }), false, 'genre metadata blocks dance/disco/remix even when admin list is empty')
assert.equal(isAllowedStationTrack({ title: 'Whitney Houston - Saving All My Love for You', artist: 'Whitney Houston', genre: 'AI generated music by Suno', blockedGenres: [] }), false, 'AI metadata is blocked')
console.log('song filter: AI, disco, dance, remix, and alternate versions are blocked')
