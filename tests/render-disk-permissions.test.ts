import assert from 'node:assert/strict'

for (const key of ['POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']) {
  delete process.env[key]
}
process.env.MORE_FM_DATA_DIR = '/root/more-fm-data'

async function main() {
  const {
    getSettings,
    hasFilesystemPersistence,
    hasPersistentStorage,
    hasSettingsPersistence,
    SETTINGS_PATH,
    STATE_PATH,
    readJson,
    writeJson,
  } = await import('../lib/storage.ts')

  assert.equal(hasFilesystemPersistence, false, 'a non-writable mounted path is disabled')
  assert.equal(hasPersistentStorage, false, 'unwritable disk is not advertised as persistent')
  assert.equal(hasSettingsPersistence, false, 'admin settings are not claimed as persistent without a real backend')

  const settings = await getSettings()
  assert.equal(settings.tagalogOnlyEnabled, true, 'station settings still load defaults after the disk check fails')
  await writeJson(STATE_PATH, { tracks: [], songCount: 7 })
  const queue = await readJson<{ songCount?: number }>(STATE_PATH, {})
  assert.equal(queue.songCount, 7, 'queue state can continue in process memory without a writable disk')
  await writeJson(SETTINGS_PATH, { tagalogOnlyEnabled: false, signOffHour: 22 })
  const updated = await getSettings()
  assert.equal(updated.tagalogOnlyEnabled, false, 'admin toggles can be saved in process memory without a persistent backend')
  assert.equal(updated.signOffHour, 22, 'schedule settings can be saved in process memory without a persistent backend')

  console.log('render-disk-permissions: inaccessible mount fallback and persistence status passed')
}

void main()
