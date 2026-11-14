import assert from 'node:assert/strict'
import {
  appendCompletedSong,
  isCompletedDailyMusicTrack,
  isInPlaybackQueue,
  repeatTitleKey,
  rollDailyPlayedLog,
} from '../lib/song-repeat.ts'

const baseKey = repeatTitleKey('Because You Loved Me', 'Celine Dion')
for (const version of [
  'Because You Loved Me - Celine Dion',
  'Celine Dion - Because You Loved Me (Official Music Video)',
  'Because You Loved Me - Acoustic Version',
  'Because You Loved Me (Live Version)',
  'Because You Loved Me - Cover by Celine Dion',
  'Song request: Because You Loved Me [Radio Edit]',
]) {
  assert.equal(repeatTitleKey(version, 'Celine Dion'), baseKey, `alternate version should share key: ${version}`)
}
assert.notEqual(repeatTitleKey('Live and Let Die', 'Paul McCartney'), repeatTitleKey('And Let Die', 'Paul McCartney'), 'words that are part of a title must not be stripped as version labels')

const day1 = '2026-11-14'
const day2 = '2026-11-15'
const played = [{ title: 'Because You Loved Me', artist: 'Celine Dion', playedAt: 100, key: baseKey }]
assert.deepEqual(rollDailyPlayedLog(day1, day1, played), { date: day1, entries: played, changed: false })
assert.deepEqual(rollDailyPlayedLog(day1, day2, played), { date: day2, entries: [], changed: true })

const completed = { title: 'Because You Loved Me', artist: 'Celine Dion', playedAt: 100, key: baseKey }
assert.deepEqual(appendCompletedSong([], completed), [completed])
const existingLedger = [completed]
assert.equal(appendCompletedSong(existingLedger, { ...completed, playedAt: 200 }), existingLedger, 'a completed title is logged only once daily')

assert.equal(isCompletedDailyMusicTrack({ kind: 'music', title: 'Song', endAt: 100, trackDay: day1, currentDay: day1, now: 100 }), true)
assert.equal(isCompletedDailyMusicTrack({ kind: 'music', title: 'Song', endAt: 101, trackDay: day1, currentDay: day1, now: 100 }), false, 'do not mark a song completed before it ends')
assert.equal(isCompletedDailyMusicTrack({ kind: 'music', title: 'Song', endAt: 100, trackDay: day1, currentDay: day2, now: 100 }), false, 'do not attribute a previous-day track to today')
assert.equal(isCompletedDailyMusicTrack({ kind: 'jingle', title: 'Station ID', endAt: 100, trackDay: day1, currentDay: day1, now: 100 }), false)

assert.equal(isInPlaybackQueue(99_000, 100_000), true, 'the just-ended track stays for the one-second processing grace')
assert.equal(isInPlaybackQueue(98_999, 100_000), false, 'a finished track is removed from the playback queue')
console.log('song-repeat: alternate versions, daily rollover, completion logging, and queue cleanup passed')
