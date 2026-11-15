import assert from 'node:assert/strict'

for (const key of ['POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'SUPABASE_DB_URL']) delete process.env[key]
process.env.SUPABASE_URL = 'https://settings-test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-not-a-real-key'
process.env.MORE_FM_DATA_DIR = '/var/data/more-fm'

const objects = new Map<string, string>()
let bucketExists = false
let failStorage = false
const originalFetch = globalThis.fetch
const realDateNow = Date.now
let timeOffset = 0
Date.now = () => realDateNow() + timeOffset

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (failStorage) throw new Error('Simulated temporary Supabase Storage outage')
  const url = new URL(input.toString())
  const method = init?.method ?? 'GET'
  if (url.pathname === '/storage/v1/bucket/more-fm-settings' && method === 'GET') {
    return new Response(JSON.stringify({ public: false }), { status: bucketExists ? 200 : 404 })
  }
  if (url.pathname === '/storage/v1/bucket' && method === 'POST') {
    bucketExists = true
    return new Response('{}', { status: 200 })
  }
  const objectPrefix = '/storage/v1/object/more-fm-settings/'
  if (url.pathname.startsWith(objectPrefix)) {
    const path = url.pathname.slice(objectPrefix.length)
    if (method === 'GET') {
      const value = objects.get(path)
      return value === undefined
        ? new Response('{}', { status: 404 })
        : new Response(value, { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (method === 'POST') {
      objects.set(path, String(init?.body ?? ''))
      return new Response('{}', { status: 200 })
    }
  }
  throw new Error(`Unexpected mocked Storage request: ${method} ${url.pathname}`)
}) as typeof fetch

async function main() {
  try {
    const { getSettings, hasPersistentStorage, hasSettingsPersistence, SETTINGS_PATH, STATE_PATH, readJson, writeJson } = await import('../lib/storage.ts')
    assert.equal(hasPersistentStorage, true, 'test simulates a configured but inaccessible Render disk')
    assert.equal(hasSettingsPersistence, true, 'private Supabase Storage is enough for admin settings')

    const initial = await getSettings()
    assert.equal(initial.tagalogOnlyEnabled, true)
    assert.equal(initial.noRepeatEnabled, true)
    assert.equal(initial.shuffleEnabled, false, 'shuffle is permanently disabled for sequential rotation')
    assert.equal(initial.jingleEnabled, false, 'regular jingles are temporarily disabled')
    assert.equal(initial.jingle, null, 'regular jingle asset is disabled')
    assert.equal(initial.goldenSunday, null, 'Golden Sunday jingle asset is disabled')
    assert.equal(initial.crossfaderEnabled, true, 'crossfader remains enabled')
    assert.equal(initial.crossfadeSeconds, 8, 'crossfade remains 8 seconds')
    assert.equal(initial.masterVolume, 80, 'daytime volume target remains 80%')
    assert.equal(initial.nightVolumePercent, 70, 'night volume target remains 70%')
    assert.equal(initial.bassGainDb, 12, 'full bass gain remains enabled')
    assert.ok(objects.has('app-state/station/settings.json'), 'settings JSON is stored in the private bucket')
    assert.ok(objects.has('app-state/station/settings-migrations-v1.json'), 'migration marker is stored durably')

    await writeJson(SETTINGS_PATH, { ...initial, tagalogOnlyEnabled: false, noRepeatEnabled: false, shuffleEnabled: false })
    timeOffset += 3_000
    const reloaded = await getSettings()
    assert.equal(reloaded.tagalogOnlyEnabled, false, 'an explicit saved Tagalog-only admin choice is preserved')
    assert.equal(reloaded.noRepeatEnabled, true, 'no-repeat remains enforced')
    assert.equal(reloaded.shuffleEnabled, false, 'an explicit saved shuffle choice is preserved')
    await writeJson(STATE_PATH, { dailyPlayedDate: '2026-11-14', dailyPlayedTitles: [{ title: 'Because You Loved Me', artist: 'Celine Dion', playedAt: 1, key: 'because you loved me' }] })
    const restoredState = await readJson<{ dailyPlayedDate?: string; dailyPlayedTitles?: Array<{ key: string }> }>(STATE_PATH, {})
    assert.equal(restoredState.dailyPlayedDate, '2026-11-14', 'queue state survives a process restart through private storage')
    assert.equal(restoredState.dailyPlayedTitles?.[0]?.key, 'because you loved me', 'daily no-repeat ledger survives redeploy')

    timeOffset += 3_000
    failStorage = true
    await writeJson(STATE_PATH, { tracks: [], songCount: 4 })
    const localState = await readJson<{ songCount?: number }>(STATE_PATH, {})
    assert.equal(localState.songCount, 4, 'station state remains readable from memory during a Storage outage without a disk')
    const fallbackSettings = await readJson<{ fallback?: boolean }>('station/settings.json', { fallback: true })
    assert.equal(fallbackSettings.fallback, true, 'missing remote settings degrade to defaults instead of failing the station API')
    console.log('settings-storage-fallback: durable storage and unavailable-disk outage fallback passed')
  } finally {
    globalThis.fetch = originalFetch
    Date.now = realDateNow
  }
}

void main()
