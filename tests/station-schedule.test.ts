import assert from 'node:assert/strict'
import { isChristmasTitle, languageForSlot, MANILA_OFFSET_MS, manilaTime, PROGRAMS, programAt } from '../lib/schedule.ts'

function manilaTimeAt(year: number, month: number, day: number, hour = 12) {
  return Date.UTC(year, month - 1, day, hour) - MANILA_OFFSET_MS
}

const sundayOldies = PROGRAMS['sunday-oldies']
for (const hour of [0, 1, 3, 4, 8, 11, 12, 16, 20, 23]) {
  const timestamp = manilaTimeAt(2026, 11, 15, hour)
  assert.equal(manilaTime(timestamp).day, 0, 'test date is Sunday in Manila')
  assert.equal(programAt(timestamp).id, 'sunday-oldies', `Sunday ${hour}:00 uses the oldies program`)
  assert.equal(languageForSlot(sundayOldies, hour), 'tagalog', 'Sunday oldies never rotate to English')
}

assert.equal(sundayOldies.tagalogOnly, true)
assert.equal(sundayOldies.pools.english.length, 0, 'Sunday oldies pool contains no English-language artists')
assert.ok(sundayOldies.pools.tagalog.length >= 20, 'Sunday uses a broad senior-classics artist pool')
assert.equal('christmas' in PROGRAMS, false, 'the Christmas program is removed for now')
assert.equal(isChristmasTitle('Santa Baby'), true)
assert.equal(isChristmasTitle('Blue Christmas'), true)
assert.equal(isChristmasTitle('Maligayang Pasko'), true)
assert.equal(isChristmasTitle('Because You Loved Me'), false)
assert.notEqual(programAt(manilaTimeAt(2026, 11, 14, 12)).id, 'sunday-oldies', 'weekday programming remains separate from Sunday oldies')

console.log('station-schedule: Christmas disabled and all-day Tagalog Sunday oldies passed')
