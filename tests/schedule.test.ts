import assert from 'node:assert/strict'
import {
  isOffAir,
  languageForSlot,
  NEW_TAGALOG_OPM_ARTISTS,
  NEW_TAGALOG_OPM_VARIANTS,
  LOVE_CONNECT_IDENT_DURATION_SECONDS,
  dailyAnnouncementScheduleAt,
  dzmmWindowAt,
  manilaDateKey,
  nextSignOn,
  PROGRAMS,
  RJFM_ARTIST_LIBRARY,
  programAt,
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
  { start: 10, end: 15, id: 'sunday-oldies', language: 'tagalog' },
  { start: 15, end: 16, id: 'sunday-tagalog-classic', language: 'tagalog' },
  { start: 15, end: 20, id: 'sunday-tagalog-classic', language: 'tagalog' },
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
assert.equal(nagaProgramAt(manilaTime(16, 4)).id, 'daytime-love', 'RJ FM Naga follows the mellow Manila rotation at 4:00 AM')
assert.equal(nagaProgramAt(manilaTime(16, 12, 59)).id, 'daytime-love', 'RJ FM Naga keeps the mellow love rotation before 1 PM')
assert.equal(nagaProgramAt(manilaTime(16, 13)).id, 'daytime-love', 'RJ FM Naga switches to love songs at 1:00 PM')
assert.equal(masbateProgramAt(manilaTime(16, 10)).id, 'masbate-tagalog', 'RJ FM Masbate stays on its Tagalog-only program')
assert.equal(languageForSlot(masbateProgramAt(manilaTime(16, 10)), 0), 'tagalog', 'RJ FM Masbate never selects English songs')
assert.equal(masbateProgramAt(manilaTime(16, 10)).pools.english.length, 0, 'RJ FM Masbate has no English artist pool')
assert.ok(!masbateProgramAt(manilaTime(16, 10)).variants.tagalog.some((variant) => /christmas|holiday|carol/i.test(variant)), 'RJ FM Masbate search variants exclude Christmas')
assert.equal(languageForSlot(PROGRAMS['daytime-love'], 0), 'english', '1 PM starts with English love songs')
assert.equal(languageForSlot(PROGRAMS['daytime-love'], 1), 'english', '1 PM keeps English as the main language')
assert.equal(languageForSlot(PROGRAMS['daytime-love'], 2), 'english', '1 PM keeps English as the main language')
assert.equal(languageForSlot(PROGRAMS['daytime-love'], 3), 'tagalog', 'a Tagalog love song appears occasionally')

assert.deepEqual(Object.keys(RJFM_ARTIST_LIBRARY), ['60s-70s', '80s-90s', '2000s', '2023-2026', 'OPM 60s-90s', 'OPM 2000s-2026'], 'artist discovery library covers classic decades through current OPM')
assert.ok(RJFM_ARTIST_LIBRARY['60s-70s'].some((artist) => artist.name === 'Nat King Cole'), '60s-70s library includes classic easy listening')
assert.ok(RJFM_ARTIST_LIBRARY['80s-90s'].some((artist) => artist.name === 'Anita Baker'), '80s-90s library includes classic soul ballads')
assert.ok(RJFM_ARTIST_LIBRARY['2000s'].some((artist) => artist.name === 'John Legend'), '2000s library includes modern soul ballads')
assert.ok(RJFM_ARTIST_LIBRARY['2023-2026'].some((artist) => artist.name === 'Benson Boone'), '2023-2026 library includes current soft-pop artists')
assert.ok(RJFM_ARTIST_LIBRARY['OPM 2000s-2026'].some((artist) => artist.name === 'Cup of Joe'), 'current OPM library includes Cup of Joe')
assert.ok(PROGRAMS['love-mix'].pools.english.some((artist) => artist.name === 'Benson Boone'), 'current soft-pop artists are available to the live love mix')
assert.ok(PROGRAMS['love-mix'].pools.tagalog.some((artist) => artist.name === 'Cup of Joe'), 'current OPM artists are available to the live love mix')
assert.ok(PROGRAMS['sunday-oldies'].pools.tagalog.some((artist) => artist.name === 'Jose Mari Chan'), 'Sunday Pinoy oldies include the expanded classic OPM library')
assert.ok(PROGRAMS['love-mix'].pools.english.length > 0, 'mellow rotation includes English songs')
assert.ok(PROGRAMS['love-mix'].pools.tagalog.length > 0, 'mellow rotation includes Tagalog songs')
assert.ok(PROGRAMS['love-mix'].variants.english.includes('soft ballad'), 'English searches prioritize soft ballads')
assert.ok(PROGRAMS['love-mix'].variants.english.includes('easy listening'), 'English searches prioritize easy listening')
assert.ok(PROGRAMS['love-mix'].variants.tagalog.includes('classic OPM ballad'), 'Tagalog searches prioritize classic OPM ballads')
assert.ok(PROGRAMS['love-mix'].pools.tagalog.some((artist) => artist.name === 'Rey Valera'), 'classic Tagalog love rotation includes Rey Valera')
assert.ok(PROGRAMS['love-mix'].pools.tagalog.some((artist) => artist.name === 'Dionela'), 'regular Tagalog love mix includes contemporary OPM artists')
assert.ok(!PROGRAMS['sunday-tagalog-classic'].pools.tagalog.some((artist) => artist.name === 'Dionela'), 'Sunday Tagalog classics remain limited to classic OPM artists')
assert.ok(NEW_TAGALOG_OPM_ARTISTS.some((artist) => artist.name === 'Adie'), 'new-song pool includes contemporary OPM artists')
assert.ok(!NEW_TAGALOG_OPM_VARIANTS.includes('Marilag'), 'new-song rotation does not force Marilag')
assert.ok(PROGRAMS['sunday-english-oldies'].pools.english.some((artist) => artist.name === 'Victor Wood'), 'Sunday English oldies include Victor Wood')
assert.ok(PROGRAMS['sunday-english-oldies'].variants.english.includes('Mr Lonely'), 'Sunday English oldies search for Mr Lonely')
assert.ok(PROGRAMS['sunday-oldies'].pools.tagalog.some((artist) => artist.name === 'Imelda Papin'), 'Sunday Pinoy jukebox includes Imelda Papin')
assert.ok(PROGRAMS['sunday-tagalog-classic'].pools.tagalog.some((artist) => artist.name === 'Rodel Naval'), 'Sunday Tagalog classics include Rodel Naval')
assert.ok(PROGRAMS['sunday-tagalog-classic'].pools.tagalog.some((artist) => artist.name === 'Lea Salonga'), 'Sunday Tagalog classics include Lea Salonga')

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
