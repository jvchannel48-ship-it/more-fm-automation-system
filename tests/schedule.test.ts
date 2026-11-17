import assert from 'node:assert/strict'
import {
  isOffAir,
  languageForSlot,
  NEW_TAGALOG_OPM_ARTISTS,
  NEW_TAGALOG_OPM_VARIANTS,
  nextSignOn,
  PROGRAMS,
  programAt,
  SIGN_OFF_HOUR,
  SIGN_ON_HOUR,
} from '../lib/schedule.ts'

function manilaTime(day: number, hour: number, minute = 0, second = 0) {
  return Date.UTC(2026, 10, day, hour - 8, minute, second)
}

const sunday = 15
const sundayBlocks = [
  { start: 4, end: 10, id: 'sunday-english-oldies', language: 'english' },
  { start: 10, end: 15, id: 'sunday-oldies', language: 'tagalog' },
  { start: 15, end: 20, id: 'sunday-tagalog-classic', language: 'tagalog' },
  { start: 20, end: 24, id: 'sunday-english-love', language: 'english' },
] as const

for (let hour = 0; hour < 24; hour++) {
  const expectedOffAir = hour >= SIGN_OFF_HOUR && hour < SIGN_ON_HOUR
  assert.equal(isOffAir(manilaTime(sunday, hour)), expectedOffAir, `Sunday ${hour}:00 follows sign-on/off schedule`)
  assert.equal(isOffAir(manilaTime(16, hour)), expectedOffAir, `Monday ${hour}:00 follows sign-on/off schedule`)
  assert.equal(programAt(manilaTime(sunday, hour), false).id, 'love-mix', `Sunday ${hour}:00 uses normal mellow rotation when Sunday schedule is OFF`)
  assert.equal(programAt(manilaTime(16, hour)).id, 'love-mix', `Monday ${hour}:00 uses normal mellow rotation`)

  const expectedBlock = sundayBlocks.find(({ start, end }) => hour >= start && hour < end)
  if (expectedBlock) {
    const program = programAt(manilaTime(sunday, hour))
    assert.equal(program.id, expectedBlock.id, `Sunday ${hour}:00 selects its special program`)
    assert.equal(languageForSlot(program, 0), expectedBlock.language, `Sunday ${hour}:00 selects the expected language`)
  }
}

assert.ok(PROGRAMS['love-mix'].pools.english.length > 0, 'mellow rotation includes English songs')
assert.ok(PROGRAMS['love-mix'].pools.tagalog.length > 0, 'mellow rotation includes Tagalog songs')
assert.ok(PROGRAMS['love-mix'].variants.english.includes('soft ballad'), 'English searches prioritize soft ballads')
assert.ok(PROGRAMS['love-mix'].variants.english.includes('easy listening'), 'English searches prioritize easy listening')
assert.ok(PROGRAMS['love-mix'].variants.tagalog.includes('soft OPM ballad'), 'Tagalog searches prioritize soft OPM ballads')
assert.ok(PROGRAMS['love-mix'].pools.tagalog.some((artist) => artist.name === 'Dionela'), 'mellow Tagalog rotation includes Dionela')
assert.ok(NEW_TAGALOG_OPM_ARTISTS.some((artist) => artist.name === 'Adie'), 'new-song pool includes contemporary OPM artists')
assert.ok(NEW_TAGALOG_OPM_VARIANTS.includes('Marilag'), 'new-song action prioritizes Marilag')
assert.ok(PROGRAMS['sunday-english-oldies'].pools.english.some((artist) => artist.name === 'Victor Wood'), 'Sunday English oldies include Victor Wood')
assert.ok(PROGRAMS['sunday-english-oldies'].variants.english.includes('Mr Lonely'), 'Sunday English oldies search for Mr Lonely')
assert.ok(PROGRAMS['sunday-oldies'].pools.tagalog.some((artist) => artist.name === 'Imelda Papin'), 'Sunday Pinoy jukebox includes Imelda Papin')
assert.ok(PROGRAMS['sunday-tagalog-classic'].pools.tagalog.some((artist) => artist.name === 'Rodel Naval'), 'Sunday Tagalog classics include Rodel Naval')
assert.ok(PROGRAMS['sunday-tagalog-classic'].pools.tagalog.some((artist) => artist.name === 'Lea Salonga'), 'Sunday Tagalog classics include Lea Salonga')

assert.equal(isOffAir(manilaTime(sunday, 0, 59)), false, 'station stays on until 1 AM sign-off')
assert.equal(isOffAir(manilaTime(sunday, 1, 0)), true, 'station signs off at 1 AM')
assert.equal(isOffAir(manilaTime(sunday, 3, 59)), true, 'station remains off before 4 AM')
assert.equal(isOffAir(manilaTime(sunday, 4, 0)), false, 'station signs on at 4 AM')
assert.equal(nextSignOn(manilaTime(sunday, 2)), manilaTime(sunday, 4), 'next sign-on during off-air is 4 AM the same day')
assert.equal(nextSignOn(manilaTime(sunday, 4)), manilaTime(16, 4), 'next sign-on after 4 AM is 4 AM the following day')

console.log('schedule: Sunday blocks, Sunday toggle fallback, and 1 AM sign-off / 4 AM sign-on all pass')
