import assert from 'node:assert/strict'
import { CHRISTMAS_ARTISTS, isChristmasSlot, isOffAir, languageForSlot, PROGRAMS, programAt } from '../lib/schedule.ts'

function manilaTime(day: number, hour: number, minute = 0, second = 0) {
  return Date.UTC(2026, 10, day, hour - 8, minute, second)
}

const sunday = 15
assert.equal(programAt(manilaTime(sunday, 16)).id, 'disco', 'disco starts at 4:00 PM Manila time')
assert.equal(programAt(manilaTime(sunday, 17)).id, 'disco', 'disco continues through the 5:00 PM minute')
assert.equal(programAt(manilaTime(sunday, 17, 0, 59)).id, 'disco', 'disco continues through 5:00:59 PM')
assert.equal(programAt(manilaTime(sunday, 17, 1)).id, 'night-love', 'Tagalog/English love songs start at 5:01 PM')
assert.ok(PROGRAMS['night-love'].pools.english.length > 0, 'night rotation includes English songs')
assert.ok(PROGRAMS['night-love'].pools.tagalog.length > 0, 'night rotation includes Tagalog songs')
assert.equal(programAt(manilaTime(sunday, 23, 59)).id, 'night-love', 'night love continues before midnight')
assert.equal(programAt(manilaTime(sunday, 0, 59)).id, 'night-love', 'night love continues until the 1:00 AM sign-off')
assert.equal(programAt(manilaTime(sunday, 1)).id, 'love-mix', 'love songs continue at 1:00 AM')
assert.equal(isOffAir(manilaTime(sunday, 3, 59)), false, 'station stays on air before 4:00 AM')
assert.equal(programAt(manilaTime(sunday, 4)).id, 'sunday-oldies', 'the existing Sunday daytime schedule remains unchanged')
assert.equal(languageForSlot(PROGRAMS['classic-love'], 0), 'english', 'Classic Love always selects English')
assert.equal(languageForSlot(PROGRAMS['classic-love'], 7), 'english', 'Classic Love does not alternate back to Tagalog')
assert.ok(PROGRAMS['classic-love'].pools.english.some((artist) => artist.name === 'James Ingram'), 'Classic Love includes James Ingram')
assert.ok(PROGRAMS['classic-love'].pools.tagalog.length === 0, 'Classic Love has no Tagalog song pool')
assert.ok(CHRISTMAS_ARTISTS.english.length > 0 && CHRISTMAS_ARTISTS.tagalog.length > 0, 'Christmas sources cover both languages')

const nov = manilaTime(sunday, 9)
assert.equal(isChristmasSlot(0, nov), true, 'November Christmas pair starts at its cadence boundary')
assert.equal(isChristmasSlot(1, nov), false, 'November cadence does not start a second pair immediately')
assert.equal(isChristmasSlot(7, nov), true, 'November Christmas pair repeats about every seven songs')
const dec = Date.UTC(2026, 11, 15, 12)
assert.equal(isChristmasSlot(4, dec), true, 'December Christmas pair repeats about every four songs')
assert.equal(isChristmasSlot(5, dec), false, 'December cadence waits until its next boundary')
assert.equal(isChristmasSlot(0, Date.UTC(2027, 0, 15, 12)), false, 'Christmas pairs do not run outside Sep–Dec')

console.log('schedule: Manila-time programming, Classic Love, and Christmas cadence checks passed')
