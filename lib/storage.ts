import 'server-only'
import { get, put } from '@vercel/blob'
import type { StationSettings } from './types'

export async function readJson<T>(pathname: string, fallback: T): Promise<T> {
  try {
    const result = await get(pathname, { access: 'private', useCache: false })
    if (!result || !result.stream) return fallback
    const text = await new Response(result.stream).text()
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

export async function writeJson(pathname: string, data: unknown) {
  await put(pathname, JSON.stringify(data), {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  })
}

export const SETTINGS_PATH = 'station/settings.json'
export const STATE_PATH = 'station/state-v2.json'
export const LISTENERS_PATH = 'station/listeners-v1.json'

export const DEFAULT_SETTINGS: StationSettings = {
  broadcastEnabled: true,
  signOffHour: 1,
  signOnHour: 4,
  jingleEnabled: false,
  commercialEnabled: false,
  jingle: null,
  commercials: [null, null, null],
  goldenSunday: null,
}

export async function getSettings(): Promise<StationSettings> {
  const saved = await readJson<Partial<StationSettings>>(SETTINGS_PATH, {})
  return {
    broadcastEnabled: typeof saved.broadcastEnabled === 'boolean' ? saved.broadcastEnabled : true,
    signOffHour: typeof saved.signOffHour === 'number' && saved.signOffHour >= 0 && saved.signOffHour <= 23 ? saved.signOffHour : 1,
    signOnHour: typeof saved.signOnHour === 'number' && saved.signOnHour >= 0 && saved.signOnHour <= 23 ? saved.signOnHour : 4,
    jingleEnabled: typeof saved.jingleEnabled === 'boolean' ? saved.jingleEnabled : false,
    commercialEnabled: typeof saved.commercialEnabled === 'boolean' ? saved.commercialEnabled : false,
    jingle: saved.jingle && typeof saved.jingle.url === 'string' ? saved.jingle : null,
    commercials: Array.from({ length: 3 }, (_, i) => {
      const asset = saved.commercials?.[i]
      return asset && typeof asset.url === 'string' ? asset : null
    }),
    goldenSunday: saved.goldenSunday && typeof saved.goldenSunday.url === 'string' ? saved.goldenSunday : null,
  }
}
