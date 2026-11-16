import assert from 'node:assert/strict'
import { normalizeMorMatchText, parseMorStreamTitle } from '../lib/mor-sync.ts'

const music = parseMorStreamTitle('CF1 BINI - No Fear.mp3', 1)
assert.equal(music.status, 'music')
assert.equal(music.artist, 'BINI')
assert.equal(music.title, 'No Fear')
assert.equal(music.key, 'bini no fear')
assert.equal(normalizeMorMatchText('No Fear'), normalizeMorMatchText('No Fear (Official Music Video)'))
assert.notEqual(normalizeMorMatchText('Fear No'), normalizeMorMatchText('No Fear'))

for (const label of [
  'Commercial break',
  'DJ talk - live on air',
  'News bulletin',
  'Station ID - More FM',
]) {
  assert.equal(parseMorStreamTitle(label, 2).status, 'non-music', `expected non-music for ${label}`)
}
assert.equal(parseMorStreamTitle('Random metadata without separator', 3).status, 'unrecognized')
console.log('mor-sync-parser: music extraction and non-music filtering passed')
