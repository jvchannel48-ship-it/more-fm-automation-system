import assert from 'node:assert/strict'
import { isChristmasTitle, isOffAir, languageForSlot, MANILA_OFFSET_MS, manilaTime, PROGRAMS, programAt } from '../lib/schedule.ts'

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
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 16)).id, 'disco', 'weekday 4 PM starts disco programming')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 17)).id, 'disco', 'weekday 5 PM uses disco programming')
assert.equal(programAt(Date.UTC(2026, 10, 14, 18, 2, 0) - MANILA_OFFSET_MS).id, 'disco', 'weekday 6:02 PM remains in disco')
assert.equal(programAt(Date.UTC(2026, 10, 14, 18, 3, 0) - MANILA_OFFSET_MS).id, 'love-mix', 'weekday 6:03 PM switches to love songs')
assert.ok(PROGRAMS['night-love'].pools.english.some((artist) => artist.name === 'Heart'), 'night love includes Heart')

for (const date of [14, 16, 17, 18, 19, 20]) {
  assert.equal(isOffAir(manilaTimeAt(2026, 11, date, 1)), true, `weekday ${date} signs off at 1 AM`)
  assert.equal(isOffAir(manilaTimeAt(2026, 11, date, 3)), true, `weekday ${date} remains off air before 4 AM`)
  assert.equal(isOffAir(manilaTimeAt(2026, 11, date, 4)), false, `weekday ${date} signs on at 4 AM`)
}
assert.equal(isOffAir(manilaTimeAt(2026, 11, 15, 2)), false, 'Sunday stays on air overnight')

console.log('station-schedule: Christmas disabled and all-day Tagalog Sunday oldies passed')
