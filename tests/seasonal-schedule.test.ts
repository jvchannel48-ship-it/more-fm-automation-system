import assert from 'node:assert/strict'
import { isChristmasSeason, isChristmasSlot, isChristmasTitle, isContinuousChristmasPeriod, MANILA_OFFSET_MS } from '../lib/schedule.ts'

function manilaTime(year: number, month: number, day: number, hour = 12) {
  return Date.UTC(year, month - 1, day, hour) - MANILA_OFFSET_MS
}

const september = manilaTime(2026, 9, 1)
const october = manilaTime(2026, 10, 1)
const november = manilaTime(2026, 11, 1)
const december = manilaTime(2026, 12, 1)
const newYear = manilaTime(2027, 1, 1, 0)
const august = manilaTime(2026, 8, 31, 23)

assert.equal(isChristmasSlot(3, september), false, 'September should not play Christmas songs back-to-back')
assert.equal(isChristmasSlot(4, september), true, 'September should slot one Christmas song after four regular songs')
assert.equal(isChristmasSlot(9, october), true, 'October keeps the same intermittent one-in-five cadence')
assert.equal(isChristmasSlot(0, november), true, 'November is a continuous Christmas rotation')
assert.equal(isChristmasSlot(12, december), true, 'December is a continuous Christmas rotation')
assert.equal(isChristmasSlot(4, newYear), false, 'Christmas rotation stops at Manila midnight on January 1')
assert.equal(isChristmasSlot(4, august), false, 'Christmas rotation is inactive before September')

assert.equal(isChristmasSeason(september), true)
assert.equal(isChristmasSeason(december), true)
assert.equal(isChristmasSeason(newYear), false)
assert.equal(isContinuousChristmasPeriod(november), true)
assert.equal(isContinuousChristmasPeriod(december), true)
assert.equal(isContinuousChristmasPeriod(october), false)
assert.equal(isContinuousChristmasPeriod(newYear), false)
assert.equal(isChristmasTitle('Santa Baby'), true, 'recognize common holiday songs without the word Christmas')
assert.equal(isChristmasTitle('Blue Christmas'), true)
assert.equal(isChristmasTitle('Maligayang Pasko'), true)
assert.equal(isChristmasTitle('Because You Loved Me'), false, 'do not classify ordinary love songs as seasonal')

console.log('seasonal-schedule: intermittent Sep–Oct, continuous Nov–Dec, Manila Jan. 1 cutoff passed')
