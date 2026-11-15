import assert from 'node:assert/strict'
import { crossfadeGain } from '../hooks/use-broadcast.ts'

for (const progress of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
  const incoming = crossfadeGain(progress, 'constant-power', true)
  const outgoing = crossfadeGain(progress, 'constant-power', false)
  assert.ok(Math.abs(incoming ** 2 + outgoing ** 2 - 1) < 1e-10, `power should remain level at ${progress}`)
}

assert.equal(crossfadeGain(0, 'constant-power', true), 0)
assert.equal(crossfadeGain(1, 'constant-power', true), 1)
assert.equal(crossfadeGain(0, 'constant-power', false), 1)
assert.ok(Math.abs(crossfadeGain(1, 'constant-power', false)) < 1e-10)

console.log('audio-crossfade: constant-power handoff remains level across the fade')
