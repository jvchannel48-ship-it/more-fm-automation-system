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

export const DEFAULT_SETTINGS: StationSettings = {
  broadcastEnabled: true,
  remixMode: false,
  fullBass: false,
  autoPost: false,
  whatsNew: '',
  screenBannerEnabled: true,
  screenBanners: [],
}

export async function getSettings(): Promise<StationSettings> {
  const saved = await readJson<Partial<StationSettings>>(SETTINGS_PATH, {})
  return {
    broadcastEnabled: typeof saved.broadcastEnabled === 'boolean' ? saved.broadcastEnabled : true,
    remixMode: typeof saved.remixMode === 'boolean' ? saved.remixMode : false,
    fullBass: typeof saved.fullBass === 'boolean' ? saved.fullBass : false,
    autoPost: typeof saved.autoPost === 'boolean' ? saved.autoPost : false,
    whatsNew: typeof saved.whatsNew === 'string' ? saved.whatsNew : '',
    screenBannerEnabled: typeof saved.screenBannerEnabled === 'boolean' ? saved.screenBannerEnabled : true,
    screenBanners: Array.isArray(saved.screenBanners) ? saved.screenBanners.filter((v): v is string => typeof v === 'string').slice(0, 3) : [],
    customArtists: Array.isArray(saved.customArtists) ? saved.customArtists.filter((a:any)=>a&&typeof a.name==='string'&&typeof a.genre==='string'&&(a.language==='english'||a.language==='tagalog')).slice(0,100) : [],
    cloudflareVerification: typeof saved.cloudflareVerification==='boolean' ? saved.cloudflareVerification : false,
  }
}
