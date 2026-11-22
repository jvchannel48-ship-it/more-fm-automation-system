import assert from 'node:assert/strict'
import {
  isOffAir,
  languageForSlot,
  LOVE_CONNECT_IDENT_DURATION_SECONDS,
  dailyAnnouncementScheduleAt,
  dzmmWindowAt,
  manilaDateKey,
  nextSignOn,
  PROGRAMS,
  RJFM_ARTIST_LIBRARY,
  programAt,
  stationProgramAt,
  nagaProgramAt,
  masbateProgramAt,
  SIGN_OFF_HOUR,
  SIGN_ON_HOUR,
} from '../lib/schedule.ts'
import { STATIONS } from '../lib/stations.ts'

function manilaTime(day: number, hour: number, minute = 0, second = 0) {
  return Date.UTC(2026, 10, day, hour - 8, minute, second)
}

const sunday = 15
const sundayBlocks = [
  { start: 4, end: 10, id: 'sunday-english-oldies', language: 'english' },
  { start: 10, end: 15, id: 'sunday-oldies', language: 'english' },
  { start: 15, end: 16, id: 'sunday-tagalog-classic', language: 'english' },
  { start: 15, end: 20, id: 'sunday-tagalog-classic', language: 'english' },
  { start: 20, end: 24, id: 'sunday-english-love', language: 'english' },
] as const

for (let hour = 0; hour < 24; hour++) {
  const expectedOffAir = false
  assert.equal(isOffAir(manilaTime(sunday, hour)), expectedOffAir, `Sunday ${hour}:00 follows sign-on/off schedule`)
  assert.equal(isOffAir(manilaTime(16, hour)), expectedOffAir, `Monday ${hour}:00 follows sign-on/off schedule`)
  const expectedNormalProgram = hour >= 4 && hour < 20 ? 'daytime-love' : 'love-mix'
  assert.equal(programAt(manilaTime(sunday, hour), false).id, expectedNormalProgram, `Sunday ${hour}:00 uses the expected normal rotation when Sunday schedule is OFF`)
  assert.equal(programAt(manilaTime(16, hour)).id, expectedNormalProgram, `Monday ${hour}:00 selects the expected regular program`)

  const expectedBlock = sundayBlocks.find(({ start, end }) => hour >= start && hour < end)
  if (expectedBlock) {
    const program = programAt(manilaTime(sunday, hour))
    assert.equal(program.id, expectedBlock.id, `Sunday ${hour}:00 selects its special program`)
    assert.equal(languageForSlot(program, 0), expectedBlock.language, `Sunday ${hour}:00 selects the expected language`)
  }
}

assert.equal(programAt(manilaTime(16, 12, 59)).id, 'daytime-love', 'weekday pre-1 PM stays on the mellow daytime love rotation')
assert.equal(programAt(manilaTime(16, 13)).id, 'daytime-love', 'weekday 1 PM starts daytime love songs')
assert.equal(programAt(manilaTime(16, 19, 59)).id, 'daytime-love', 'daytime love runs through the afternoon')
assert.equal(programAt(manilaTime(16, 20)).id, 'love-mix', 'evening returns to the normal mellow mix')
assert.equal(nagaProgramAt(manilaTime(16, 4)).id, programAt(manilaTime(16, 4)).id, 'RJ FM Naga follows Manila program schedule')
assert.equal(nagaProgramAt(manilaTime(16, 12, 59)).id, programAt(manilaTime(16, 12, 59)).id, 'RJ FM Naga stays on the same Manila program')
assert.equal(nagaProgramAt(manilaTime(16, 13)).id, programAt(manilaTime(16, 13)).id, 'RJ FM Naga follows Manila program changes')
assert.equal(stationProgramAt(manilaTime(16, 10), true, 'naga').id, programAt(manilaTime(16, 10)).id, 'Naga uses Manila program selection for its one-song relay')
assert.equal(masbateProgramAt(manilaTime(16, 10)).id, 'masbate-tagalog', 'RJ FM Masbate has its own Tagalog OPM format')
assert.equal(languageForSlot(masbateProgramAt(manilaTime(16, 10)), 0), 'tagalog', 'RJ FM Masbate selects Tagalog songs only')
assert.ok(masbateProgramAt(manilaTime(16, 10)).pools.tagalog.length > 0, 'RJ FM Masbate has its approved OPM artist pool')
assert.equal(masbateProgramAt(manilaTime(16, 10)).pools.english.length, 0, 'RJ FM Masbate has no English rotation')
for (const station of ['cebu', 'gensan', 'davao']) {
  const regional = stationProgramAt(manilaTime(16, 10), true, station)
  assert.ok(regional.pools.english.length > 0, `${station} has an independent English soft-music pool`)
  assert.ok(regional.pools.tagalog.length > 0, `${station} has an independent OPM pool`)
  assert.equal(languageForSlot(regional, 3), 'tagalog', `${station} rotates in OPM`)
}
for (const station of ['cdo', 'iloilo']) {
  const regional = stationProgramAt(manilaTime(16, 10), true, station)
  assert.equal(languageForSlot(regional, 0), 'tagalog', `${station} uses its Tagalog OPM format`)
}
assert.equal(languageForSlot(PROGRAMS['daytime-love'], 0), 'english', '1 PM starts with English love songs')
assert.equal(languageForSlot(PROGRAMS['daytime-love'], 1), 'english', '1 PM keeps English as the main language')
assert.equal(languageForSlot(PROGRAMS['daytime-love'], 2), 'english', '1 PM keeps English as the main language')
assert.equal(languageForSlot(PROGRAMS['daytime-love'], 3), 'english', 'all daytime slots stay English-only')

assert.ok(RJFM_ARTIST_LIBRARY['60s-70s'].some((artist) => artist.name === 'Nat King Cole'), 'approved artist library includes classic easy listening')
assert.ok(RJFM_ARTIST_LIBRARY['80s-90s'].some((artist) => artist.name === 'Anita Baker'), 'approved artist library includes classic soft soul')
assert.ok(RJFM_ARTIST_LIBRARY['2023-2026'].some((artist) => artist.name === 'Benson Boone'), 'approved artist library includes current soft-pop artists')
for (const [id, program] of Object.entries(PROGRAMS)) {
  if (id === 'off-air' || id === 'masbate-tagalog') continue
  assert.equal(program.englishOnly, true, `${id} is English-only`)
  assert.equal(program.pools.tagalog.length, 0, `${id} has no Tagalog artists`)
  assert.equal(languageForSlot(program, 0), 'english', `${id} selects English`)
  assert.equal(languageForSlot(program, 3), 'english', `${id} remains English on every slot`)
  assert.ok(program.pools.english.length > 0, `${id} has approved English artists`)
  assert.ok(program.variants.english.some((variant) => /easy listening|soft|mellow/i.test(variant)), `${id} searches for smooth easy-listening tracks`)
}
assert.equal(PROGRAMS['masbate-tagalog'].tagalogOnly, true, 'Masbate is configured for Tagalog-only music')
assert.ok(PROGRAMS['masbate-tagalog'].variants.tagalog.some((variant) => /OPM|Tagalog/i.test(variant)), 'Masbate searches for OPM tracks')
assert.ok(PROGRAMS['love-mix'].pools.english.some((artist) => artist.name === 'Benson Boone'), 'current soft-pop artists remain in the approved rotation')
assert.ok(PROGRAMS['love-mix'].pools.english.some((artist) => artist.name === 'Nat King Cole'), 'classic English oldies remain in the approved rotation')

assert.equal(SIGN_OFF_HOUR, SIGN_ON_HOUR, '24/7 RJ FM has no daily sign-off gap')
for (const station of Object.values(STATIONS)) {
  assert.equal(station.signOffHour, station.signOnHour, `${station.name} has no daily off-air gap`)
  for (let hour = 0; hour < 24; hour++) {
    assert.equal(isOffAir(manilaTime(sunday, hour)), false, `RJ FM remains on-air at ${hour}:00`)
  }
}
assert.equal(isOffAir(manilaTime(sunday, 3, 0)), false, 'RJ FM remains on-air at 3 AM')
assert.equal(isOffAir(manilaTime(sunday, 3, 59)), false, 'RJ FM remains on-air before 4 AM')
assert.equal(isOffAir(manilaTime(sunday, 4, 0)), false, 'RJ FM remains on-air at 4 AM')
assert.equal(nextSignOn(manilaTime(sunday, 2)), manilaTime(sunday, 4), '24/7 station reports the next daily schedule marker without signing off')
assert.equal(nextSignOn(manilaTime(sunday, 4)), manilaTime(16, 4), 'next daily schedule marker is 4 AM tomorrow')
assert.equal(programAt(manilaTime(16, 16, 0)).id, 'daytime-love', '4:00 PM stays on classic love songs')
assert.equal(programAt(manilaTime(16, 18, 2)).id, 'daytime-love', '6:02 PM stays on classic love songs')
assert.equal(programAt(manilaTime(16, 18, 3)).id, 'daytime-love', '6:03 PM starts the love-song mix')

const mondayMorning = dzmmWindowAt(manilaTime(16, 7))
assert.equal(mondayMorning?.endAt, manilaTime(16, 8), 'weekday morning DZMM ends at 8:00 AM')
assert.equal(mondayMorning?.liveStartAt, mondayMorning?.startAt, 'morning DZMM has no additional ident delay')
assert.equal(dzmmWindowAt(manilaTime(16, 6, 59)), null, 'weekday music remains on before 7:00 AM')
assert.equal(dzmmWindowAt(manilaTime(16, 12)), null, 'weekday noon remains RJ FM music')
assert.equal(dzmmWindowAt(manilaTime(16, 18, 29)), null, 'RJ FM music remains on before the 6:30 PM DZMM handoff')
assert.equal(dzmmWindowAt(manilaTime(16, 18, 30))?.startAt, manilaTime(16, 18, 30), 'weekday evening DZMM starts at 6:30 PM')
assert.equal(dzmmWindowAt(manilaTime(16, 18, 30))?.endAt, manilaTime(16, 20), 'weekday evening DZMM ends at 8:00 PM')
assert.equal(dzmmWindowAt(manilaTime(15, 12)), null, 'Sunday remains music-only at noon')
assert.equal(dzmmWindowAt(manilaTime(16, 18, 30))?.endAt, manilaTime(16, 20), 'weekday TV Patrol runs until 8:00 PM')
assert.equal(dzmmWindowAt(manilaTime(21, 18, 30))?.endAt, manilaTime(21, 20), 'Saturday TV Patrol ends at 8:00 PM')
assert.equal(dzmmWindowAt(manilaTime(21, 20, 1)), null, 'Saturday music resumes at 8:01 PM')
assert.equal(dzmmWindowAt(manilaTime(16, 21, 59)), null, 'weekday evening music remains before 10:00 PM')
assert.equal(dzmmWindowAt(manilaTime(16, 0)), null, 'Monday after midnight remains music-only after Sunday')
assert.equal(dzmmWindowAt(manilaTime(16, 2, 59)), null, 'Monday remains music-only before the 3:00 AM sign-off')
const mondayOvernight = dzmmWindowAt(manilaTime(16, 22))
assert.equal(mondayOvernight?.startAt, manilaTime(16, 22), 'weekday Love Connect ident starts at 10:00 PM')
assert.equal(
  mondayOvernight?.liveStartAt,
  manilaTime(16, 22) + LOVE_CONNECT_IDENT_DURATION_SECONDS * 1000,
  'weekday DZMM live starts after the complete Love Connect ident',
)
const saturdayOvernight = dzmmWindowAt(manilaTime(21, 22))
assert.ok(saturdayOvernight, 'Saturday evening has an overnight DZMM window')
assert.equal(saturdayOvernight.liveStartAt, saturdayOvernight.startAt + LOVE_CONNECT_IDENT_DURATION_SECONDS * 1000, 'Saturday DZMM follows the full ident')
assert.equal(saturdayOvernight?.endAt, manilaTime(22, 0), 'Saturday overnight DZMM ends at midnight Sunday')
assert.equal(dzmmWindowAt(manilaTime(22, 0)), null, 'Sunday remains music-only after the Saturday window ends')
const tuesdayOvernight = dzmmWindowAt(manilaTime(17, 2, 59))
assert.equal(tuesdayOvernight?.startAt, mondayOvernight?.startAt, 'Tuesday after-midnight DZMM continues Monday evening’s window')
assert.equal(tuesdayOvernight?.liveStartAt, mondayOvernight?.liveStartAt, 'the ident delay is not restarted after midnight')
const mondayTvPatrol = dzmmWindowAt(manilaTime(16, 18, 30))
assert.equal(mondayTvPatrol?.liveStartAt, mondayTvPatrol?.startAt, 'the TV Patrol window keeps its current live start')
assert.equal(tuesdayOvernight?.endAt, manilaTime(17, 3), 'overnight DZMM ends at 3:00 AM')
assert.equal(dzmmWindowAt(manilaTime(15, 12)), null, 'Sunday remains music-only')
assert.equal(dzmmWindowAt(manilaTime(15, 14)), null, 'Sunday afternoon remains music-only')

const mondayAfternoonDzmm = dzmmWindowAt(manilaTime(16, 14))
assert.equal(mondayAfternoonDzmm, null, 'RJ FM music runs after the noon DZMM block')
assert.equal(dzmmWindowAt(manilaTime(16, 8, 1)), null, 'MOR music resumes at 8:01 AM')
assert.equal(dzmmWindowAt(manilaTime(16, 21, 59)), null, 'MOR music remains on before the 10:00 PM DZMM return')

const mondayAnnouncement = dailyAnnouncementScheduleAt(manilaTime(16, 12))
assert.equal(mondayAnnouncement?.kind, 'weekday', 'Monday uses the new weekday announcement')
assert.equal(mondayAnnouncement?.songsRequired, 3, 'Monday announcement follows 3 songs')
assert.equal(mondayAnnouncement?.expiresAt, manilaTime(16, 21, 45), 'weekday announcement disappears at 9:45 PM')
assert.equal(dailyAnnouncementScheduleAt(manilaTime(16, 21, 45))?.expiresAt, manilaTime(16, 21, 45), 'weekday expiry is fixed for the day')
const saturdayAnnouncement = dailyAnnouncementScheduleAt(manilaTime(21, 12))
assert.equal(saturdayAnnouncement?.kind, 'saturday', 'Saturday uses the original announcement')
assert.equal(saturdayAnnouncement?.songsRequired, 5, 'Saturday announcement follows 5 songs')
assert.equal(saturdayAnnouncement?.expiresAt, manilaTime(22, 0), 'Saturday announcement ends at Sunday midnight')
assert.equal(dailyAnnouncementScheduleAt(manilaTime(15, 12)), null, 'Sunday has no announcement clip schedule')
assert.equal(manilaDateKey(manilaTime(16, 21, 48)), '2026-11-16', 'daily automation uses the Manila calendar date')

console.log('schedule: DZMM windows and continuous 24/7 RJ FM station schedules all pass')
