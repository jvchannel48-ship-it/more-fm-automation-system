import assert from 'node:assert/strict'

for (const key of ['BLOB_READ_WRITE_TOKEN', 'VERCEL_OIDC_TOKEN', 'BLOB_STORE_ID']) delete process.env[key]

const originalDateNow = Date.now
let clock = 1_000_000
Date.now = () => clock

async function main() {
  try {
    const { getActiveListenerCount, getSettings, isBlobStorageAvailable, recordListener, SETTINGS_PATH, writeJson } = await import('../lib/storage.ts')

    const defaults = await getSettings()
    assert.equal(defaults.christmasEnabled, false, 'Christmas pair defaults to OFF')
    assert.equal(defaults.classicLoveSongsEnabled, false, 'Classic Love defaults to OFF')

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

    await writeJson(SETTINGS_PATH, { broadcastEnabled: false })
    assert.equal((await getSettings()).broadcastEnabled, false, 'the broadcast OFF toggle remains readable in memory fallback')
    await writeJson(SETTINGS_PATH, { broadcastEnabled: true })
    assert.equal((await getSettings()).broadcastEnabled, true, 'the broadcast ON toggle remains readable in memory fallback')

    await writeJson(SETTINGS_PATH, { christmasEnabled: true, classicLoveSongsEnabled: true })
    const seasonalSettings = await getSettings()
    assert.equal(seasonalSettings.christmasEnabled, true, 'the Christmas toggle is saved in memory fallback')
    assert.equal(seasonalSettings.classicLoveSongsEnabled, true, 'the Classic Love toggle is saved in memory fallback')

    console.log('listener-count: memory fallback, live count, expiry, and broadcast toggle checks passed')
  } finally {
    Date.now = originalDateNow
  }
}

void main()
