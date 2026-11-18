import assert from 'node:assert/strict'
import {
  clearAllNotificationState,
  filterVisibleNotifications,
  MAX_SAVED_NOTIFICATION_IDS,
  mergeNotificationIds,
} from '../lib/notification-state.ts'

const sharedNotifications = [
  { id: 'notice-1', title: 'Station update' },
  { id: 'notice-2', title: 'Program reminder' },
]
const originalNotifications = structuredClone(sharedNotifications)
const initialDismissedIds = ['notice-old']
const initialReadIds = ['notice-read']

const clearedState = clearAllNotificationState(
  sharedNotifications,
  initialDismissedIds,
  initialReadIds,
)

assert.deepEqual(clearedState.dismissedIds, ['notice-old', 'notice-1', 'notice-2'])
assert.deepEqual(clearedState.readIds, ['notice-read', 'notice-1', 'notice-2'])
assert.deepEqual(
  filterVisibleNotifications(sharedNotifications, clearedState.dismissedIds),
  [],
  'clear all hides every notification that was visible at the time of clearing',
)
assert.deepEqual(
  filterVisibleNotifications(
    [...sharedNotifications, { id: 'notice-new', title: 'New announcement' }],
    clearedState.dismissedIds,
  ).map((notification) => notification.id),
  ['notice-new'],
  'a notification received after clearing remains visible',
)
assert.deepEqual(sharedNotifications, originalNotifications, 'clearing does not mutate the shared notification list')
assert.deepEqual(initialDismissedIds, ['notice-old'], 'clear-all state does not mutate existing dismissal IDs')
assert.deepEqual(initialReadIds, ['notice-read'], 'clear-all state does not mutate existing read IDs')

assert.deepEqual(
  mergeNotificationIds(['a', 'b', 'a'], ['b', 'c']),
  ['a', 'b', 'c'],
  'saved IDs are deduplicated while preserving their order',
)

const manyIds = Array.from({ length: MAX_SAVED_NOTIFICATION_IDS + 1 }, (_, index) => `notice-${index}`)
const boundedIds = mergeNotificationIds(manyIds, ['notice-newest'])
assert.equal(boundedIds.length, MAX_SAVED_NOTIFICATION_IDS, 'saved IDs stay within the configured limit')
assert.equal(boundedIds.includes('notice-newest'), true, 'the newest IDs are retained')
assert.equal(boundedIds.includes('notice-0'), false, 'the oldest IDs are trimmed first')

console.log('notification state: clear-all, read state, new arrivals, immutability, and ID bounds all pass')
