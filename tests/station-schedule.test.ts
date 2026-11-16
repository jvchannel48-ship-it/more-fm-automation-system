import assert from 'node:assert/strict'
import { isChristmasTitle, isOffAir, languageForSlot, MANILA_OFFSET_MS, manilaTime, nextPlaylistBoundary, playlistAt, PROGRAMS, programAt, rotationProgramFor } from '../lib/schedule.ts'

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
assert.equal(programAt(manilaTimeAt(2026, 11, 15, 22)).id, 'night-love', 'Sunday 10 PM starts the mixed-language night-love program')
assert.equal(programAt(manilaTimeAt(2026, 11, 15, 23, 59)).id, 'night-love', 'Sunday late night stays on the night-love program')
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
assert.ok(PROGRAMS['night-love'].pools.tagalog.some((artist) => artist.name === 'Sarah Geronimo'), 'night love includes Sarah Geronimo')
assert.deepEqual([0, 1, 2, 3].map((count) => languageForSlot(PROGRAMS['night-love'], count)), ['english', 'english', 'tagalog', 'tagalog'], 'night love alternates two English and two Tagalog songs')
assert.equal(rotationProgramFor(PROGRAMS['night-love'], 1, true, false).id, 'night-love', 'night love overrides the daytime Tagalog-only setting')
assert.equal(rotationProgramFor(PROGRAMS['love-mix'], 1, true, false).id, 'sunday-tagalog', 'daytime Tagalog-only preference remains in effect')

for (const date of [14, 15, 16, 17, 18, 19, 20]) {
  for (const hour of [0, 1, 3, 4, 16, 23]) {
    assert.equal(isOffAir(manilaTimeAt(2026, 11, date, hour)), false, `day ${date} hour ${hour} remains on air`)
  }
  assert.equal(playlistAt(manilaTimeAt(2026, 11, date, 0, 1)), 'senior-classics', 'senior playlist finishes through 12:01 AM')
  assert.equal(playlistAt(manilaTimeAt(2026, 11, date, 0, 2)), 'overnight', '12:02 AM starts the overnight playlist')
  assert.equal(playlistAt(manilaTimeAt(2026, 11, date, 3, 59)), 'overnight', 'overnight playlist runs until 4 AM')
  assert.equal(playlistAt(manilaTimeAt(2026, 11, date, 4)), 'morning-pop', '4 AM starts the morning playlist')
  assert.equal(playlistAt(manilaTimeAt(2026, 11, date, 15, 59)), 'morning-pop', 'morning playlist runs until 4 PM')
  assert.equal(playlistAt(manilaTimeAt(2026, 11, date, 16)), 'senior-classics', '4 PM starts the senior classics playlist')
  assert.equal(nextPlaylistBoundary(manilaTimeAt(2026, 11, date, 0, 1)), manilaTimeAt(2026, 11, date, 0, 2), '12:02 AM handoff is exact')
  assert.equal(nextPlaylistBoundary(manilaTimeAt(2026, 11, date, 3, 59)), manilaTimeAt(2026, 11, date, 4), '4 AM handoff is exact')
  assert.equal(nextPlaylistBoundary(manilaTimeAt(2026, 11, date, 15, 59)), manilaTimeAt(2026, 11, date, 16), '4 PM handoff is exact')
  assert.equal(nextPlaylistBoundary(manilaTimeAt(2026, 11, date, 23, 59)), manilaTimeAt(2026, 11, date + 1, 0, 2), 'senior playlist handoff is exact at 12:02 AM')
}

console.log('station-schedule: continuous broadcasting and daily playlist rotation passed')
