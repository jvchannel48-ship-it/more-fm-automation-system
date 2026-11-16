import 'server-only'
import { get, put } from '@vercel/blob'
import type { StationSettings } from './types'

const memoryFallback = new Map<string, string>()
const BLOB_RETRY_DELAY_MS = 15_000
let retryBlobAfter = 0
let warnedAboutFallback = false

function hasBlobCredentials() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID),
  )
}

function readMemory<T>(pathname: string, fallback: T): T {
  const text = memoryFallback.get(pathname)
  if (!text) return fallback
  try {
    return JSON.parse(text) as T
  } catch {
    memoryFallback.delete(pathname)
    return fallback
  }
}

function warnMemoryFallback() {
  if (warnedAboutFallback) return
  warnedAboutFallback = true
  console.warn('[morefm] Vercel Blob unavailable; using process-memory station state until storage recovers')
}

export async function readJson<T>(pathname: string, fallback: T): Promise<T> {
  if (!hasBlobCredentials() || Date.now() < retryBlobAfter) {
    warnMemoryFallback()
    return readMemory(pathname, fallback)
  }

  try {
    const result = await get(pathname, { access: 'private', useCache: false })
    if (!result || !result.stream) return readMemory(pathname, fallback)
    const text = await new Response(result.stream).text()
    const data = JSON.parse(text) as T
    memoryFallback.set(pathname, text)
    retryBlobAfter = 0
    return data
  } catch {
    retryBlobAfter = Date.now() + BLOB_RETRY_DELAY_MS
    warnMemoryFallback()
    return readMemory(pathname, fallback)
  }
}

export async function writeJson(pathname: string, data: unknown) {
  const text = JSON.stringify(data)
  memoryFallback.set(pathname, text)
  if (!hasBlobCredentials() || Date.now() < retryBlobAfter) {
    warnMemoryFallback()
    return
  }

  try {
    await put(pathname, text, {
      access: 'private',
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    })
    retryBlobAfter = 0
  } catch {
    retryBlobAfter = Date.now() + BLOB_RETRY_DELAY_MS
    warnMemoryFallback()
  }
}

export const SETTINGS_PATH = 'station/settings.json'
export const STATE_PATH = 'station/state-v2.json'

export const DEFAULT_SETTINGS: StationSettings = {
  broadcastEnabled: true,
}

export async function getSettings(): Promise<StationSettings> {
  const saved = await readJson<Partial<StationSettings>>(SETTINGS_PATH, {})
  return {
    broadcastEnabled: typeof saved.broadcastEnabled === 'boolean' ? saved.broadcastEnabled : true,
  }
}
