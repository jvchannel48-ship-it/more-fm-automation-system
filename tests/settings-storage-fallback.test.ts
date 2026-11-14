import assert from 'node:assert/strict'

for (const key of ['POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'SUPABASE_DB_URL']) delete process.env[key]
process.env.SUPABASE_URL = 'https://settings-test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-not-a-real-key'

const objects = new Map<string, string>()
let bucketExists = false
const originalFetch = globalThis.fetch
const realDateNow = Date.now
let timeOffset = 0
Date.now = () => realDateNow() + timeOffset

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
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
    const { getSettings, hasPersistentStorage, hasSettingsPersistence, SETTINGS_PATH, writeJson } = await import('../lib/storage.ts')
    assert.equal(hasPersistentStorage, false, 'test is running without PostgreSQL')
    assert.equal(hasSettingsPersistence, true, 'private Supabase Storage is enough for admin settings')

    const initial = await getSettings()
    assert.equal(initial.tagalogOnlyEnabled, true)
    assert.equal(initial.noRepeatEnabled, true)
    assert.equal(initial.shuffleEnabled, false, 'shuffle is permanently disabled for sequential rotation')
    assert.ok(objects.has('app-state/station/settings.json'), 'settings JSON is stored in the private bucket')
    assert.ok(objects.has('app-state/station/settings-migrations-v1.json'), 'migration marker is stored durably')

    await writeJson(SETTINGS_PATH, { ...initial, tagalogOnlyEnabled: false, noRepeatEnabled: false, shuffleEnabled: false })
    timeOffset += 3_000
    const reloaded = await getSettings()
    assert.equal(reloaded.tagalogOnlyEnabled, false, 'an explicit saved Tagalog-only admin choice is preserved')
    assert.equal(reloaded.noRepeatEnabled, true, 'no-repeat remains enforced')
    assert.equal(reloaded.shuffleEnabled, false, 'an explicit saved shuffle choice is preserved')
    console.log('settings-storage-fallback: durable private JSON fallback without PostgreSQL passed')
  } finally {
    globalThis.fetch = originalFetch
    Date.now = realDateNow
  }
}

void main()
