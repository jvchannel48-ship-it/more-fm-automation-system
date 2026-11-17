import assert from 'node:assert/strict'

for (const key of ['BLOB_READ_WRITE_TOKEN', 'VERCEL_OIDC_TOKEN', 'BLOB_STORE_ID']) delete process.env[key]

const originalDateNow = Date.now
let clock = 1_000_000
Date.now = () => clock

async function main() {
  try {
    const { getActiveListenerCount, getSettings, isBlobStorageAvailable, recordListener, SETTINGS_PATH, writeJson } = await import('../lib/storage.ts')

    const first = await recordListener('listener-test-000001', true)
    assert.equal(first.listenersNow, 1, 'a playing browser is counted')
    assert.equal(first.persistenceConfigured, false, 'memory fallback is not reported as durable storage')
    await recordListener('listener-test-000002', true)
    assert.equal(await getActiveListenerCount(), 2, 'the dashboard counts both active listener IDs')

    await recordListener('listener-test-000001', false)
    assert.equal(await getActiveListenerCount(), 1, 'pausing playback removes that listener')

    clock += 61_000
    assert.equal(await getActiveListenerCount(), 0, 'stale heartbeats expire after one minute')
    assert.equal(isBlobStorageAvailable(), false, 'storage status stays false when no Blob token is configured')

    assert.equal((await getSettings()).sundayScheduleEnabled, true, 'Sunday special programming defaults ON')
    assert.equal((await getSettings()).newTagalogOpmEnabled, false, 'modern Tagalog OPM mode defaults OFF')
    await writeJson(SETTINGS_PATH, { broadcastEnabled: false })
    assert.equal((await getSettings()).broadcastEnabled, false, 'the broadcast OFF toggle remains readable in memory fallback')
    await writeJson(SETTINGS_PATH, { broadcastEnabled: true })
    assert.equal((await getSettings()).broadcastEnabled, true, 'the broadcast ON toggle remains readable in memory fallback')
    await writeJson(SETTINGS_PATH, { broadcastEnabled: true, sundayScheduleEnabled: false })
    assert.equal((await getSettings()).sundayScheduleEnabled, false, 'Sunday schedule OFF toggle persists in memory fallback')
    await writeJson(SETTINGS_PATH, { broadcastEnabled: true, sundayScheduleEnabled: true })
    assert.equal((await getSettings()).sundayScheduleEnabled, true, 'Sunday schedule ON toggle persists in memory fallback')
    await writeJson(SETTINGS_PATH, { broadcastEnabled: true, sundayScheduleEnabled: true, newTagalogOpmEnabled: true })
    assert.equal((await getSettings()).newTagalogOpmEnabled, true, 'OPM mode stays ON after reading settings again')
    await writeJson(SETTINGS_PATH, { broadcastEnabled: true, sundayScheduleEnabled: true, newTagalogOpmEnabled: false })
    assert.equal((await getSettings()).newTagalogOpmEnabled, false, 'OPM mode turns OFF after an explicit admin toggle')

    console.log('listener-count: memory fallback, listener expiry, broadcast, Sunday, and persistent OPM toggle checks passed')
  } finally {
    Date.now = originalDateNow
  }
}

void main()
