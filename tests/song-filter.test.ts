import assert from 'node:assert/strict'
import { isOriginalArtistTrack } from '../lib/song-filter.ts'

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

for (const title of [
  'Whitney Houston - I Wanna Dance With Somebody',
  'Whitney Houston - Pop Goes the World',
  'Whitney Houston - Rock the Night',
  'Whitney Houston - I Look to You (Club Remix)',
  'Whitney Houston - I Look to You (Cover by Jane Doe)',
  'Whitney Houston - I Look to You (Tribute)',
  'Calum Scott, Whitney Houston - I Wanna Dance With Somebody',
  'Someone Else - Cover of Whitney Houston',
  'Whitney Houston - Canción en español',
  'Whitney Houston - AI-generated version',
]) {
  assert.equal(isOriginalArtistTrack(title, whitney), false, `excluded: ${title}`)
}

console.log('song filter: only artist-credited originals pass; dance/pop/rock and cover/remix results are rejected')
