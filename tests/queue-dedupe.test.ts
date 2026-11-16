import assert from 'node:assert/strict'
import { dedupeMusicQueue } from '../lib/queue-dedupe.ts'

const refreshedQueue = [
  { kind: 'music', title: 'Song A (Official Audio)', artist: 'Artist A', youtubeId: 'video-a' },
  { kind: 'music', title: 'Song A - Artist A (Official Music Video)', artist: 'Artist A', youtubeId: 'video-b' },
  { kind: 'music', title: 'Different title metadata', artist: 'Artist B', youtubeId: 'video-a' },
  { kind: 'music', title: 'Song B', artist: 'Artist B', youtubeId: 'video-b' },
  { kind: 'jingle', title: 'Station ID', youtubeId: 'video-a' },
]

const firstPass = dedupeMusicQueue(refreshedQueue)
const secondPass = dedupeMusicQueue([...firstPass, ...firstPass, ...firstPass])
assert.deepEqual(firstPass.map((track) => track.title), ['Song A (Official Audio)', 'Song B', 'Station ID'])
assert.equal(secondPass.filter((track) => track.kind === 'music').length, 2, 'repeated refreshes must not add duplicate music tracks')
assert.equal(new Set(secondPass.filter((track) => track.kind === 'music').map((track) => track.youtubeId)).size, 2)

const differentMetadata = dedupeMusicQueue([
  { kind: 'music', title: 'Because You Loved Me', artist: 'Celine Dion', youtubeId: 'same-id' },
  { kind: 'music', title: 'Because You Loved Me (Live)', artist: 'Celine Dion', youtubeId: 'same-id' },
])
assert.equal(differentMetadata.length, 1, 'same video ID must be rejected even when metadata changes')
console.log('queue-dedupe: refresh, title, and exact video ID duplicate tests passed')
