import 'server-only'

const BUCKET = 'more-fm-media'
const MAX_FILE_SIZE = 4 * 1024 * 1024
let bucketReady: Promise<void> | null = null

function config() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Supabase Storage is not configured for this deployment.')
  return { url, key }
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
