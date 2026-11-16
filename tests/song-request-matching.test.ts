import assert from 'node:assert/strict'
import { matchesRequestedSong } from '../lib/song-request-matching.ts'

assert.equal(matchesRequestedSong('Celine Dion - Because You Loved Me (Official Audio)', 'Random Music Uploads', 'Because You Loved Me', 'Celine Dion'), true, 'exact title and artist match should not fail because the channel is not labeled official')
assert.equal(matchesRequestedSong('Because You Loved Me', 'Celine Dion - Topic', 'Because You Loved Me', 'Celine Dion'), true, 'artist credit may come from the channel')
assert.equal(matchesRequestedSong('Celine Dion - Because You Loved Me (Official HD Audio)', 'Celine Dion Official', 'Because You Loved Me', 'Celine Dion'), true, 'official quality labels do not prevent an exact match')
assert.equal(matchesRequestedSong('Because You Loved Me', 'Adele Official', 'Because You Loved Me', 'Celine Dion'), false, 'wrong artist must not match')
assert.equal(matchesRequestedSong('My Heart Will Go On', 'Celine Dion Official', 'Because You Loved Me', 'Celine Dion'), false, 'wrong title must not match')
assert.equal(matchesRequestedSong('Celine Dion - Because You Loved Me (Official Audio)', 'Celine Dion Official', '', 'Celine Dion'), false, 'empty titles are not valid matches')

console.log('song-request-matching: exact title and artist matching passed')
