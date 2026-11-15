import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectSingleBreakAudio } from '../lib/break-rotation.ts'

const jingle = { url: '/jingle.mp3', name: 'RJ FM Jingle', duration: 8 }
const golden = { url: '/golden.mp3', name: 'Golden Sunday ID', duration: 9 }

test('regular music break contains only one station jingle', () => {
  assert.deepEqual(selectSingleBreakAudio({
    sundayGoldenBreak: false,
    regularBreak: true,
    jingleEnabled: true,
    goldenSunday: golden,
    jingle,
  }), { asset: jingle, kind: 'jingle' })
})

test('overlapping Sunday and regular breaks prioritize one Golden Sunday spot', () => {
  assert.deepEqual(selectSingleBreakAudio({
    sundayGoldenBreak: true,
    regularBreak: true,
    jingleEnabled: true,
    goldenSunday: golden,
    jingle,
  }), { asset: golden, kind: 'golden-sunday' })
})

test('no configured break audio returns no spot', () => {
  assert.equal(selectSingleBreakAudio({
    sundayGoldenBreak: true,
    regularBreak: true,
    jingleEnabled: false,
    goldenSunday: null,
    jingle: null,
  }), null)
})

console.log('break-rotation: single break spot selection passed')
