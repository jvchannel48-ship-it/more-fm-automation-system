import assert from 'node:assert/strict'
import { isOffAir, nextSignOn, PROGRAMS, programAt, SIGN_OFF_HOUR, SIGN_ON_HOUR } from '../lib/schedule.ts'

function manilaTime(day: number, hour: number, minute = 0, second = 0) {
  return Date.UTC(2026, 10, day, hour - 8, minute, second)
}

const sunday = 15
for (const hour of Array.from({ length: 24 }, (_, index) => index)) {
  const expectedOffAir = hour >= SIGN_OFF_HOUR && hour < SIGN_ON_HOUR
  assert.equal(isOffAir(manilaTime(sunday, hour)), expectedOffAir, `Sunday ${hour}:00 follows sign-on/off schedule`)
  assert.equal(isOffAir(manilaTime(16, hour)), expectedOffAir, `Monday ${hour}:00 follows sign-on/off schedule`)
  if (!expectedOffAir) {
    assert.equal(programAt(manilaTime(sunday, hour)).id, 'love-mix', `Sunday ${hour}:00 uses the mellow mix`)
    assert.equal(programAt(manilaTime(16, hour)).id, 'love-mix', `Monday ${hour}:00 uses the mellow mix`)
  }
}
assert.ok(PROGRAMS['love-mix'].pools.english.length > 0, 'mellow rotation includes English songs')
assert.ok(PROGRAMS['love-mix'].pools.tagalog.length > 0, 'mellow rotation includes Tagalog songs')
assert.ok(PROGRAMS['love-mix'].variants.english.includes('soft ballad'), 'English searches prioritize soft ballads')
assert.ok(PROGRAMS['love-mix'].variants.english.includes('easy listening'), 'English searches prioritize easy listening')
assert.ok(PROGRAMS['love-mix'].variants.tagalog.includes('soft OPM ballad'), 'Tagalog searches prioritize soft OPM ballads')
assert.equal(isOffAir(manilaTime(sunday, 0, 59)), false, 'station stays on until 1 AM sign-off')
assert.equal(isOffAir(manilaTime(sunday, 1, 0)), true, 'station signs off at 1 AM')
assert.equal(isOffAir(manilaTime(sunday, 3, 59)), true, 'station remains off before 4 AM')
assert.equal(isOffAir(manilaTime(sunday, 4, 0)), false, 'station signs on at 4 AM')
assert.equal(nextSignOn(manilaTime(sunday, 2)), manilaTime(sunday, 4), 'next sign-on during off-air is 4 AM the same day')
assert.equal(nextSignOn(manilaTime(sunday, 4)), manilaTime(16, 4), 'next sign-on after 4 AM is 4 AM the following day')

console.log('schedule: auto sign-off at 1 AM, sign-on at 4 AM, mellow English/Tagalog mix while on-air')
