import assert from 'node:assert/strict'
import { firstPlayableRequest, orderedPendingRequests } from '../lib/song-request-queue.ts'

type Request = { id: string; requestedAt: number; status: 'pending' | 'played' | 'skipped' }
const requests: Request[] = [
  { id: 'later', requestedAt: 30, status: 'pending' },
  { id: 'played', requestedAt: 10, status: 'played' },
  { id: 'first', requestedAt: 10, status: 'pending' },
  { id: 'middle', requestedAt: 20, status: 'pending' },
]

assert.deepEqual(orderedPendingRequests(requests).map((request) => request.id), ['first', 'middle', 'later'])
assert.equal(firstPlayableRequest(requests, (request) => request.id !== 'first')?.id, 'middle')
assert.equal(firstPlayableRequest(requests, () => false), null)
const longQueue = Array.from({ length: 20 }, (_, index) => ({ id: String(index), requestedAt: index, status: 'pending' as const }))
assert.equal(orderedPendingRequests(longQueue).length, 20, 'all pending requests are read, not just the first 12')
assert.equal(firstPlayableRequest(longQueue, (request) => request.id === '19')?.id, '19', 'a playable request beyond the old limit is not blocked by earlier unmatched requests')
console.log('song-request-queue: all FIFO and skip-unmatched tests passed')
