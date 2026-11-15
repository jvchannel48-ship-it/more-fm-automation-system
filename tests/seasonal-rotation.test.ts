import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CHRISTMAS_REGULAR_TRACK_INTERVAL, christmasModeForManilaTime, planChristmasTrack } from '../lib/seasonal-rotation.ts'

function manilaTimestamp(year: number, month: number, day: number, hour = 0, minute = 0) {
  return Date.UTC(year, month - 1, day, hour - 8, minute)
}

test('Christmas mode follows Manila calendar dates and turns off at January 1', () => {
  assert.equal(christmasModeForManilaTime(manilaTimestamp(2026, 8, 31, 23, 59)), 'off')
  assert.equal(christmasModeForManilaTime(manilaTimestamp(2026, 9, 1)), 'single')
  assert.equal(christmasModeForManilaTime(manilaTimestamp(2026, 10, 31, 23, 59)), 'single')
  assert.equal(christmasModeForManilaTime(manilaTimestamp(2026, 11, 1)), 'triple')
  assert.equal(christmasModeForManilaTime(manilaTimestamp(2026, 12, 31, 23, 59)), 'triple')
  assert.equal(christmasModeForManilaTime(manilaTimestamp(2027, 1, 1)), 'off')
})

test('September and October insert one Christmas song after 20 regular songs', () => {
  const date = manilaTimestamp(2026, 9, 15)
  let state = { regularTracksSinceChristmas: 0, christmasTracksRemaining: 0 }
  for (let index = 0; index < CHRISTMAS_REGULAR_TRACK_INTERVAL; index++) {
    const decision = planChristmasTrack(date, state)
    assert.equal(decision.playChristmas, false)
    state = decision.nextState
  }
  const holiday = planChristmasTrack(date, state)
  assert.equal(holiday.playChristmas, true)
  assert.equal(holiday.nextState.christmasTracksRemaining, 0)
  const next = planChristmasTrack(date, holiday.nextState)
  assert.equal(next.playChristmas, false)
})

test('November and December schedule exactly three Christmas songs consecutively', () => {
  const date = manilaTimestamp(2026, 11, 15)
  let state = { regularTracksSinceChristmas: CHRISTMAS_REGULAR_TRACK_INTERVAL, christmasTracksRemaining: 0 }
  const sequence: boolean[] = []
  for (let index = 0; index < 4; index++) {
    const decision = planChristmasTrack(date, state)
    sequence.push(decision.playChristmas)
    state = decision.nextState
  }
  assert.deepEqual(sequence, [true, true, true, false])
})

test('a pending Christmas burst is cleared at midnight on January 1', () => {
  const jan1 = manilaTimestamp(2027, 1, 1)
  const decision = planChristmasTrack(jan1, { regularTracksSinceChristmas: 0, christmasTracksRemaining: 2 })
  assert.equal(decision.playChristmas, false)
  assert.deepEqual(decision.nextState, { regularTracksSinceChristmas: 0, christmasTracksRemaining: 0 })
})
