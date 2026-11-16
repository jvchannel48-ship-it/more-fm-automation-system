import assert from 'node:assert/strict'
import { isOffAir, PROGRAMS, programAt } from '../lib/schedule.ts'

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
assert.equal(programAt(manilaTime(sunday, 1)).id, 'off-air', 'station signs off at 1:00 AM')
assert.equal(isOffAir(manilaTime(sunday, 3, 59)), true, 'station stays off air until 4:00 AM')
assert.equal(programAt(manilaTime(sunday, 4)).id, 'sunday-oldies', 'the existing Sunday daytime schedule remains unchanged')

console.log('schedule: Manila-time disco, night-love, sign-off, and daytime checks passed')
