import assert from 'node:assert/strict'
import { isOffAir, PROGRAMS, programAt } from '../lib/schedule.ts'

function manilaTime(day: number, hour: number, minute = 0, second = 0) {
  return Date.UTC(2026, 10, day, hour - 8, minute, second)
}

const sunday = 15
for (const hour of Array.from({ length: 24 }, (_, index) => index)) {
  assert.equal(programAt(manilaTime(sunday, hour)).id, 'love-mix', `Sunday ${hour}:00 uses the mellow mix`)
  assert.equal(programAt(manilaTime(16, hour)).id, 'love-mix', `Monday ${hour}:00 uses the mellow mix`)
}
assert.ok(PROGRAMS['love-mix'].pools.english.length > 0, 'mellow rotation includes English songs')
assert.ok(PROGRAMS['love-mix'].pools.tagalog.length > 0, 'mellow rotation includes Tagalog songs')
assert.ok(PROGRAMS['love-mix'].variants.english.includes('soft ballad'), 'English searches prioritize soft ballads')
assert.ok(PROGRAMS['love-mix'].variants.english.includes('easy listening'), 'English searches prioritize easy listening')
assert.ok(PROGRAMS['love-mix'].variants.tagalog.includes('soft OPM ballad'), 'Tagalog searches prioritize soft OPM ballads')
assert.equal(isOffAir(manilaTime(sunday, 3, 59)), false, 'station stays on air overnight')

console.log('schedule: mellow English/Tagalog love mix is selected all day every day')
