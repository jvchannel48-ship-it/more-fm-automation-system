import assert from 'node:assert/strict'
import { needsManilaDailyReset, spendCredits } from '../lib/credit-math.ts'

assert.deepEqual(spendCredits(10, 10), { accepted: true, dailyCredits: 0, bonusCredits: 0, creditsRemaining: 0 })
assert.deepEqual(spendCredits(40, 5), { accepted: true, dailyCredits: 20, bonusCredits: 5, creditsRemaining: 25 })
assert.deepEqual(spendCredits(5, 40), { accepted: true, dailyCredits: 0, bonusCredits: 25, creditsRemaining: 25 })
assert.deepEqual(spendCredits(19, 0), { accepted: false, dailyCredits: 19, bonusCredits: 0, creditsRemaining: 19 })
assert.equal(needsManilaDailyReset('2026-11-17', '2026-11-18'), true)
assert.equal(needsManilaDailyReset('2026-11-18', '2026-11-18'), false)
assert.throws(() => spendCredits(-1, 0), RangeError)
console.log('credit math: daily-first 20-credit charging, insufficient balances, and Manila date reset checks passed')
