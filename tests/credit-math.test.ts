import assert from 'node:assert/strict'
import { needsManilaDailyReset, spendCredits, SONG_REQUEST_CREDIT_COST } from '../lib/credit-math.ts'

assert.equal(SONG_REQUEST_CREDIT_COST, 15)
assert.deepEqual(spendCredits(10, 5), { accepted: true, dailyCredits: 0, bonusCredits: 0, creditsRemaining: 0 })
assert.deepEqual(spendCredits(40, 5), { accepted: true, dailyCredits: 25, bonusCredits: 5, creditsRemaining: 30 })
assert.deepEqual(spendCredits(5, 40), { accepted: true, dailyCredits: 0, bonusCredits: 30, creditsRemaining: 30 })
assert.deepEqual(spendCredits(14, 0), { accepted: false, dailyCredits: 14, bonusCredits: 0, creditsRemaining: 14 })
assert.deepEqual(spendCredits(15, 0), { accepted: true, dailyCredits: 0, bonusCredits: 0, creditsRemaining: 0 })
assert.equal(needsManilaDailyReset('2026-11-17', '2026-11-18'), true)
assert.equal(needsManilaDailyReset('2026-11-18', '2026-11-18'), false)
assert.throws(() => spendCredits(-1, 0), RangeError)
console.log('credit math: daily-first 15-credit charging (30 per 2 songs), insufficient balances, and Manila date reset checks passed')
