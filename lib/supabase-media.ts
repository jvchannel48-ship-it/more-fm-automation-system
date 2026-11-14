import 'server-only'

const BUCKET = 'more-fm-media'
const SETTINGS_BUCKET = 'more-fm-settings'
const MAX_FILE_SIZE = 4 * 1024 * 1024
let bucketReady: Promise<void> | null = null
let settingsBucketReady: Promise<void> | null = null

function config() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Supabase Storage is not configured for this deployment.')
  return { url, key }
}

export function hasSupabaseStorageConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  return Boolean(url && key)
}

function authHeaders(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}` }
}

function encodedPath(pathname: string) {
  return pathname.split('/').map(encodeURIComponent).join('/')
}

async function createBucketIfNeeded() {
  const { url, key } = config()
  const headers = authHeaders(key)
  const existing = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers, cache: 'no-store' })
  if (existing.ok) return
  if (existing.status !== 404) {
    throw new Error(`Supabase Storage bucket check failed (${existing.status}).`)
  }
  const created = await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_FILE_SIZE }),
    cache: 'no-store',
  })
  if (created.ok || created.status === 409) return
  const verify = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers, cache: 'no-store' })
  if (verify.ok) return
  throw new Error(`Supabase Storage bucket creation failed (${created.status}).`)
}

export async function ensureSupabaseMediaBucket() {
  if (!bucketReady) {
    bucketReady = createBucketIfNeeded().catch((error) => {
      bucketReady = null
      throw error
    })
  }
  await bucketReady
}

async function createSettingsBucketIfNeeded() {
  const { url, key } = config()
  const headers = authHeaders(key)
  const bucketUrl = `${url}/storage/v1/bucket/${SETTINGS_BUCKET}`
  const existing = await fetch(bucketUrl, { headers, cache: 'no-store' })
  if (existing.ok) {
    const details = await existing.json().catch(() => ({})) as { public?: unknown }
    if (details.public !== false) throw new Error('Supabase Storage settings bucket must be private.')
    return
  }
  if (existing.status !== 404) throw new Error(`Supabase Storage settings bucket check failed (${existing.status}).`)
  const created = await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: SETTINGS_BUCKET, name: SETTINGS_BUCKET, public: false, file_size_limit: MAX_FILE_SIZE }),
    cache: 'no-store',
  })
  if (!created.ok && created.status !== 409) throw new Error(`Supabase Storage settings bucket creation failed (${created.status}).`)
  const verify = await fetch(bucketUrl, { headers, cache: 'no-store' })
  if (!verify.ok) throw new Error(`Supabase Storage settings bucket verification failed (${verify.status}).`)
  const details = await verify.json().catch(() => ({})) as { public?: unknown }
  if (details.public !== false) throw new Error('Supabase Storage settings bucket must be private.')
}

export async function ensureSupabaseSettingsBucket() {
  if (!settingsBucketReady) {
    settingsBucketReady = createSettingsBucketIfNeeded().catch((error) => {
      settingsBucketReady = null
      throw error
    })
  }
  await settingsBucketReady
}

export async function uploadSupabaseAudio(pathname: string, file: File, contentType: string) {
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) throw new Error('Audio must be under 4 MB.')
  await ensureSupabaseMediaBucket()
  const { url, key } = config()
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodedPath(pathname)}`, {
    method: 'POST',
    headers: {
      ...authHeaders(key),
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: Buffer.from(await file.arrayBuffer()),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Supabase Storage upload failed (${response.status}).`)
  }
}

export async function deleteSupabaseAudio(pathname: string) {
  await ensureSupabaseMediaBucket()
  const { url, key } = config()
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodedPath(pathname)}`, {
    method: 'DELETE',
    headers: authHeaders(key),
    cache: 'no-store',
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(`Supabase Storage delete failed (${response.status}).`)
  }
}

export async function fetchSupabaseAudio(pathname: string) {
  const { url, key } = config()
  return fetch(`${url}/storage/v1/object/${BUCKET}/${encodedPath(pathname)}`, {
    headers: authHeaders(key),
    cache: 'no-store',
  })
}

export async function readSupabaseJson(pathname: string): Promise<unknown | null> {
  await ensureSupabaseSettingsBucket()
  const { url, key } = config()
  const response = await fetch(`${url}/storage/v1/object/${SETTINGS_BUCKET}/${encodedPath(pathname)}`, {
    headers: authHeaders(key),
    cache: 'no-store',
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Supabase Storage settings read failed (${response.status}).`)
  return response.json()
}

export async function writeSupabaseJson(pathname: string, value: unknown) {
  await ensureSupabaseSettingsBucket()
  const { url, key } = config()
  const response = await fetch(`${url}/storage/v1/object/${SETTINGS_BUCKET}/${encodedPath(pathname)}`, {
    method: 'POST',
    headers: {
      ...authHeaders(key),
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    },
    body: JSON.stringify(value),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Supabase Storage settings write failed (${response.status}).`)
}
