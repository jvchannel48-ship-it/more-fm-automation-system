const STORAGE_KEY = 'morefm_device_id'

/** Stable id for this phone/browser. Used instead of create-account. */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing && /^[a-zA-Z0-9_-]{16,80}$/.test(existing)) return existing
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
    const normalized = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
    const safe = normalized.length >= 16 ? normalized : `${normalized}${Date.now().toString(36)}`.slice(0, 32)
    window.localStorage.setItem(STORAGE_KEY, safe)
    return safe
  } catch {
    return `tmp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  }
}

export async function ensureDeviceSession(): Promise<boolean> {
  const deviceId = getOrCreateDeviceId()
  if (!deviceId) return false
  const response = await fetch('/api/account/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'device', deviceId }),
    cache: 'no-store',
  })
  return response.ok
}
