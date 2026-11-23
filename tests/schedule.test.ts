import assert from 'node:assert/strict'
import {
  isOffAir, languageForSlot, manilaTime, programAt, nagaProgramAt, masbateProgramAt, calabangaProgramAt,
  dzmmWindowAt, iloiloDzmmWindowAt, PROGRAMS, RJFM_ARTIST_LIBRARY, SIGN_OFF_HOUR, SIGN_ON_HOUR,
} from '../lib/schedule.ts'
import { STATIONS } from '../lib/stations.ts'

function at(day: number, hour: number, minute = 0) {
  return Date.UTC(2026, 10, day, hour - 8, minute)
}
const saturday = 21
const sunday = 22
const monday = 23

assert.equal(programAt(at(saturday, 4, 19)).id, 'daytime-love')
assert.equal(programAt(at(saturday, 4, 20)).id, 'daytime-love')
assert.equal(programAt(at(saturday, 21, 59)).id, 'daytime-love')
assert.equal(programAt(at(saturday, 22)).id, 'night-love')
assert.equal(programAt(at(sunday, 0)).id, 'daytime-love')
assert.equal(programAt(at(sunday, 12)).id, 'daytime-love')
assert.equal(programAt(at(sunday, 23)).id, 'night-love')
assert.equal(languageForSlot(programAt(at(sunday, 12)), 0), 'english')
assert.equal(languageForSlot(programAt(at(sunday, 12)), 1), 'english')
assert.equal(languageForSlot(programAt(at(sunday, 12)), 2), 'english')
assert.equal(languageForSlot(programAt(at(sunday, 12)), 3), 'tagalog')
assert.equal(programAt(at(monday, 8)).id, 'daytime-love')
assert.equal(languageForSlot(programAt(at(monday, 12)), 0), 'english')
assert.equal(languageForSlot(programAt(at(monday, 12)), 1), 'english')
assert.equal(languageForSlot(programAt(at(monday, 12)), 2), 'english')
assert.equal(languageForSlot(programAt(at(monday, 12)), 3), 'tagalog')
assert.equal(languageForSlot(programAt(at(monday, 23)), 3), 'tagalog')
assert.equal(dzmmWindowAt(at(monday, 7)), null)
assert.equal(dzmmWindowAt(at(monday, 22)), null)
assert.equal(iloiloDzmmWindowAt(at(monday, 18, 30)), null)
assert.ok(PROGRAMS['sunday-tagalog-classic'].pools.tagalog.some(a => a.name === 'Imelda Papin'))
assert.ok(PROGRAMS['sunday-tagalog-classic'].pools.tagalog.some(a => a.name === 'Victor Wood'))
assert.ok(PROGRAMS['sunday-tagalog-classic'].pools.tagalog.some(a => a.name === 'Rodel Naval'))
assert.ok(PROGRAMS['sunday-tagalog-classic'].pools.tagalog.some(a => a.name === 'April Boy Regino'))
assert.ok(PROGRAMS['sunday-tagalog-classic'].pools.english.length > 0)
assert.ok(RJFM_ARTIST_LIBRARY['OPM 60s-90s'].some(a => a.name === 'Imelda Papin'))
assert.equal(SIGN_OFF_HOUR, SIGN_ON_HOUR)
assert.equal(isOffAir(at(sunday, 3)), false)
for (const station of Object.values(STATIONS)) assert.equal(station.signOffHour, station.signOnHour)
assert.equal(nagaProgramAt(at(sunday, 15)).id, 'daytime-love')
assert.equal(masbateProgramAt(at(monday, 10)).tagalogOnly, undefined)
assert.equal(calabangaProgramAt(at(monday, 14, 59)).id, 'daytime-love')
assert.equal(calabangaProgramAt(at(monday, 15, 0)).id, 'daytime-love')
assert.equal(calabangaProgramAt(at(monday, 20, 2)).id, 'daytime-love')
assert.equal(calabangaProgramAt(at(monday, 20, 3)).id, 'daytime-love')
assert.equal(STATIONS.calabanga.frequency, '95.5')
assert.equal(STATIONS.calabanga.signOffHour, STATIONS.calabanga.signOnHour)
console.log('schedule: nationwide love-song rotation, no seasonal Christmas programming')
