import assert from 'node:assert/strict'
import { isChristmasTitle, isOffAir, languageForSlot, MANILA_OFFSET_MS, manilaTime, nextSundayPlaylistBoundary, PROGRAMS, programAt, sundayPlaylistAt } from '../lib/schedule.ts'

function manilaTimeAt(year: number, month: number, day: number, hour = 12, minute = 0) {
  return Date.UTC(year, month - 1, day, hour, minute) - MANILA_OFFSET_MS
}

const sundayOldies = PROGRAMS['sunday-oldies']
for (const hour of [10, 11, 12, 16]) {
  const timestamp = manilaTimeAt(2026, 11, 15, hour)
  assert.equal(manilaTime(timestamp).day, 0, 'test date is Sunday in Manila')
  assert.equal(programAt(timestamp).id, 'sunday-oldies', `Sunday ${hour}:00 uses the oldies program`)
  assert.equal(languageForSlot(sundayOldies, hour), 'tagalog', 'Sunday oldies never rotate to English')
}

const sundayEnglishOldies = PROGRAMS['sunday-english-oldies']
assert.equal(programAt(manilaTimeAt(2026, 11, 15, 4)).id, 'sunday-english-oldies', 'Sunday 4 AM starts English senior oldies')
assert.equal(programAt(manilaTimeAt(2026, 11, 15, 8, 59)).id, 'sunday-english-oldies', 'Sunday 8:59 AM remains English senior oldies')
assert.equal(languageForSlot(sundayEnglishOldies, 0), 'english', 'Sunday early oldies use English rotation')
assert.ok(sundayEnglishOldies.pools.english.some((artist) => artist.name === 'Victor Wood'), 'Sunday early oldies include Victor Wood')
assert.equal(programAt(manilaTimeAt(2026, 11, 15, 9, 0)).id, 'sunday-english-oldies', 'Sunday 9:00 AM remains English senior oldies')
assert.equal(programAt(manilaTimeAt(2026, 11, 15, 9, 1)).id, 'sunday-oldies', 'Sunday 9:01 AM uses senior Tagalog oldies')
assert.equal(programAt(manilaTimeAt(2026, 11, 15, 17, 1)).id, 'sunday-oldies', 'Sunday 5:01 PM remains senior Tagalog oldies')
assert.equal(programAt(manilaTimeAt(2026, 11, 15, 17, 2)).id, 'sunday-tagalog', 'Sunday 5:02 PM starts Tagalog love songs')
assert.equal(programAt(manilaTimeAt(2026, 11, 15, 20, 59)).id, 'sunday-tagalog', 'Sunday 8:59 PM remains Tagalog love songs')
assert.equal(programAt(manilaTimeAt(2026, 11, 15, 21)).id, 'english-love', 'Sunday 9 PM starts English evening love songs')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 16, 59)).id, 'love-mix', 'Saturday 4:59 PM remains regular programming')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 17)).id, 'love-mix', 'Saturday 5 PM remains on RJ FM music')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 17, 59)).id, 'love-mix', 'Saturday 5:59 PM remains on RJ FM music')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 20, 59)).id, 'love-mix', 'Saturday 8:59 PM remains on RJ FM music')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 21)).id, 'english-love', 'Saturday 9 PM returns to RJ FM music')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 22)).id, 'night-love', 'Saturday 10 PM remains on RJ FM music')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 23, 59)).id, 'night-love', 'Saturday 11:59 PM remains on RJ FM music')
assert.equal(programAt(manilaTimeAt(2026, 11, 16, 0)).id, 'love-mix', 'Monday midnight returns to RJ FM music')

assert.equal(sundayOldies.tagalogOnly, true)
assert.equal(sundayOldies.pools.english.length, 0, 'Sunday Tagalog oldies pool contains no English-language artists')
assert.ok(sundayOldies.pools.tagalog.length >= 20, 'Sunday uses a broad senior-classics artist pool')
assert.equal('christmas' in PROGRAMS, false, 'the Christmas program is removed for now')
assert.equal(isChristmasTitle('Santa Baby'), true)
assert.equal(isChristmasTitle('Blue Christmas'), true)
assert.equal(isChristmasTitle('Maligayang Pasko'), true)
assert.equal(isChristmasTitle('Because You Loved Me'), false)
assert.notEqual(programAt(manilaTimeAt(2026, 11, 14, 12)).id, 'sunday-oldies', 'weekday programming remains separate from Sunday oldies')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 16)).id, 'love-mix', 'weekday 4 PM no longer starts disco programming')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 17)).id, 'love-mix', 'weekday 5 PM remains on RJ FM music')
assert.equal(programAt(Date.UTC(2026, 10, 14, 18, 59, 0) - MANILA_OFFSET_MS).id, 'love-mix', 'weekday 6:59 PM remains on RJ FM music')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 19)).id, 'love-mix', 'weekday 7 PM remains on RJ FM music')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 20)).id, 'love-mix', 'weekday 8 PM remains on RJ FM music')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 21)).id, 'english-love', 'weekday 9 PM switches back to RJ FM music')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 22)).id, 'night-love', 'weekday 10 PM remains on RJ FM music')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 23, 59)).id, 'night-love', 'weekday 11:59 PM remains on RJ FM music')
assert.equal(programAt(manilaTimeAt(2026, 11, 14, 0)).id, 'love-mix', 'weekday midnight switches to continuous RJ FM music')
assert.ok(PROGRAMS['night-love'].pools.english.some((artist) => artist.name === 'Heart'), 'night love includes Heart')

for (const date of [14, 16, 17, 18, 19, 20]) {
  assert.equal(isOffAir(manilaTimeAt(2026, 11, date, 1)), true, `weekday ${date} signs off at 1 AM`)
  assert.equal(isOffAir(manilaTimeAt(2026, 11, date, 3)), true, `weekday ${date} remains off air before 4 AM`)
  assert.equal(isOffAir(manilaTimeAt(2026, 11, date, 4)), false, `weekday ${date} signs on at 4 AM`)
}
assert.equal(isOffAir(manilaTimeAt(2026, 11, 15, 2)), false, 'Sunday stays on air overnight')
assert.equal(sundayPlaylistAt(manilaTimeAt(2026, 11, 15, 3, 59)), 'rj-fm', 'Sunday before 4 AM uses RJ FM playlist')
assert.equal(sundayPlaylistAt(manilaTimeAt(2026, 11, 15, 4)), 'golden-sunday', 'Sunday 4 AM starts Golden Sunday playlist')
assert.equal(sundayPlaylistAt(manilaTimeAt(2026, 11, 15, 11, 59)), 'golden-sunday', 'Golden Sunday runs through 11:59 AM')
assert.equal(sundayPlaylistAt(manilaTimeAt(2026, 11, 15, 12)), 'sunday-afternoon', 'Sunday noon switches to the afternoon playlist')
assert.equal(sundayPlaylistAt(manilaTimeAt(2026, 11, 15, 22, 1)), 'sunday-afternoon', 'Sunday 10:01 PM remains on the afternoon playlist')
assert.equal(sundayPlaylistAt(manilaTimeAt(2026, 11, 15, 22, 2)), 'rj-fm', 'Sunday 10:02 PM switches to RJ FM playlist')
assert.equal(nextSundayPlaylistBoundary(manilaTimeAt(2026, 11, 15, 11, 59)), manilaTimeAt(2026, 11, 15, 12), 'Golden Sunday tracks end at noon')
assert.equal(nextSundayPlaylistBoundary(manilaTimeAt(2026, 11, 15, 22, 1)), manilaTimeAt(2026, 11, 15, 22, 2), 'Afternoon tracks end at 10:02 PM')
assert.equal(sundayPlaylistAt(manilaTimeAt(2026, 11, 16, 12)), null, 'Weekday playlist selection is not Sunday-specific')

console.log('station-schedule: Christmas disabled and all-day Tagalog Sunday oldies passed')
