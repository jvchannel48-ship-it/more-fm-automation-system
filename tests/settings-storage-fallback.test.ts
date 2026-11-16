import assert from 'node:assert/strict'

for (const key of ['POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'SUPABASE_DB_URL']) delete process.env[key]
process.env.SUPABASE_URL = 'https://settings-test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-not-a-real-key'
process.env.MORE_FM_DATA_DIR = '/root/more-fm-data'

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
    const { getSettings, getStoredListenerCount, hasFilesystemPersistence, hasPersistentStorage, hasSettingsPersistence, LISTENERS_PATH, SETTINGS_PATH, STATE_PATH, readJson, registerListener, writeJson } = await import('../lib/storage.ts')
    assert.equal(hasFilesystemPersistence, false, 'an inaccessible Render mount is not advertised as persistent')
    assert.equal(hasPersistentStorage, false, 'a configured but unwritable disk is not persistent storage')
    assert.equal(hasSettingsPersistence, true, 'private Supabase Storage is enough for admin settings')

    await writeJson(SETTINGS_PATH, { crossfaderCurve: 'smooth', crossfadeSeconds: 8 })
    const initial = await getSettings()
    assert.equal(initial.tagalogOnlyEnabled, true)
    assert.equal(initial.noRepeatEnabled, true)
    assert.equal(initial.shuffleEnabled, true, 'shuffle is enabled by default for randomized rotation')
    assert.equal(initial.listenerLimit, 2, 'the default listener cap remains two')
    assert.equal(initial.jingleEnabled, true, 'the configured default station jingle is enabled')
    assert.equal(initial.jingle?.url, '/rj-fm-jingle.mp3', 'the default station jingle remains configured')
    assert.equal(initial.goldenSunday, null, 'Golden Sunday jingle asset is disabled')
    assert.equal(initial.crossfaderEnabled, true, 'crossfader remains enabled')
    assert.equal(initial.crossfadeSeconds, 8, 'crossfade remains 8 seconds')
    assert.equal(initial.crossfaderCurve, 'constant-power', 'new installs use a constant-power fade')
    assert.equal(initial.masterVolume, 80, 'daytime volume target remains 80%')
    assert.equal(initial.nightVolumePercent, 70, 'night volume target remains 70%')
    assert.equal(initial.bassGainDb, 12, 'full bass gain remains enabled')
    assert.ok(objects.has('app-state/station/settings.json'), 'settings JSON is stored in the private bucket')
    assert.ok(objects.has('app-state/station/settings-migrations-v1.json'), 'migration marker is stored durably')
    assert.equal(JSON.parse(objects.get('app-state/station/settings-migrations-v1.json') ?? '{}').crossfaderCurve, 1, 'equal-power settings migration is recorded')
    assert.equal(JSON.parse(objects.get('app-state/station/settings-migrations-v1.json') ?? '{}').shuffleEnabled, 1, 'shuffle default migration is recorded')

    const listenerOne = await registerListener('listener-tab-id-000001', true, 2)
    const listenerTwo = await registerListener('listener-tab-id-000002', true, 2)
    const listenerThree = await registerListener('listener-tab-id-000003', true, 2)
    assert.deepEqual([listenerOne.accepted, listenerOne.listenersNow], [true, 1], 'first active tab is counted')
    assert.deepEqual([listenerTwo.accepted, listenerTwo.listenersNow], [true, 2], 'second active tab fills the default capacity')
    assert.deepEqual([listenerThree.accepted, listenerThree.listenersNow], [false, 2], 'a new tab is rejected when the listener cap is reached')
    assert.equal(await getStoredListenerCount(), 2, 'admin listener monitor reads active sessions from shared storage')
    assert.ok(objects.has(`app-state/${LISTENERS_PATH}`), 'active listener heartbeats are stored in private storage')
    await registerListener('listener-tab-id-000001', false, 2)
    assert.equal(await getStoredListenerCount(), 1, 'stopping a player removes its listener session')
    timeOffset += 61_000
    assert.equal(await getStoredListenerCount(), 0, 'inactive sessions expire after 60 seconds')

    await writeJson(SETTINGS_PATH, { ...initial, tagalogOnlyEnabled: false, noRepeatEnabled: false, shuffleEnabled: false, listenerLimit: 7, crossfaderCurve: 'smooth', crossfadeSeconds: 5 })
    timeOffset += 3_000
    const reloaded = await getSettings()
    assert.equal(reloaded.tagalogOnlyEnabled, false, 'an explicit saved Tagalog-only admin choice is preserved')
    assert.equal(reloaded.noRepeatEnabled, true, 'no-repeat remains enforced')
    assert.equal(reloaded.shuffleEnabled, false, 'an explicit saved shuffle choice is preserved')
    assert.equal(reloaded.listenerLimit, 7, 'an explicit saved listener cap is preserved')
    assert.equal(reloaded.crossfaderCurve, 'smooth', 'a later explicit admin curve choice is honored')
    assert.equal(reloaded.crossfadeSeconds, 5, 'a later explicit admin crossfade duration is honored')
    await writeJson(STATE_PATH, { dailyPlayedDate: '2026-11-14', dailyPlayedTitles: [{ title: 'Because You Loved Me', artist: 'Celine Dion', playedAt: 1, key: 'because you loved me' }] })
    const restoredState = await readJson<{ dailyPlayedDate?: string; dailyPlayedTitles?: Array<{ key: string }> }>(STATE_PATH, {})
    assert.equal(restoredState.dailyPlayedDate, '2026-11-14', 'queue state survives a process restart through private storage')
    assert.equal(restoredState.dailyPlayedTitles?.[0]?.key, 'because you loved me', 'daily no-repeat ledger survives redeploy')

    timeOffset += 3_000
    failStorage = true
    await writeJson(STATE_PATH, { tracks: [], songCount: 4 })
    const localState = await readJson<{ songCount?: number }>(STATE_PATH, {})
    assert.equal(localState.songCount, 4, 'station state remains readable from memory during a Storage outage without a disk')
    await writeJson(SETTINGS_PATH, { ...reloaded, tagalogOnlyEnabled: true, signOffHour: 22 })
    const localSettings = await getSettings()
    assert.equal(localSettings.tagalogOnlyEnabled, true, 'admin toggles remain writable from process memory during a Storage outage')
    assert.equal(localSettings.signOffHour, 22, 'admin schedule settings remain writable from process memory during a Storage outage')
    const fallbackSettings = await readJson<{ signOffHour?: number }>('station/settings.json', {})
    assert.equal(fallbackSettings.signOffHour, 22, 'locally saved admin settings remain readable during a Storage outage')
    console.log('settings-storage-fallback: durable storage and unavailable-disk outage fallback passed')
  } finally {
    globalThis.fetch = originalFetch
    Date.now = realDateNow
  }
}

void main()
