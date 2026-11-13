import { type NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getAdminStatus, refreshQueue } from '@/lib/station'
import { getSettings, SETTINGS_PATH, writeJson } from '@/lib/storage'
const jsonError = (message: string, status = 500) => NextResponse.json({ error: message }, { status })
export async function GET() {
  try {
    if (!(await isAdmin())) return jsonError('Unauthorized', 401)
    return NextResponse.json(await getAdminStatus())
  } catch (error) {
    console.error('[morefm] admin settings GET failed', error)
    return jsonError('Could not load admin settings.')
  }
}
export async function PUT(request: NextRequest) {
  try {
    if (!(await isAdmin())) return jsonError('Unauthorized', 401)
    const body = (await request.json().catch(() => ({}))) as {
      broadcastEnabled?: unknown; autoDjEnabled?: unknown; shuffleEnabled?: unknown; goodVibesEnabled?: unknown; rotationPoolSize?: unknown; listenerLimit?: unknown; tagalogOnlyEnabled?: unknown; transmitterWatts?: unknown
      signOffHour?: unknown; signOnHour?: unknown; discoStartHour?: unknown; discoEndHour?: unknown
      christmasEnabled?: unknown; autoVoiceEnabled?: unknown; djMicEnabled?: unknown; newsEnabled?: unknown; nightVolumeEnabled?: unknown
      nightVolumeStartHour?: unknown; nightVolumeEndHour?: unknown; jingleEnabled?: unknown; commercialEnabled?: unknown
    }
    const current = await getSettings()
    const hour = (value: unknown, fallback: number) => typeof value === 'number' && value >= 0 && value <= 23 ? value : fallback
    const signOffHour = hour(body.signOffHour, current.signOffHour)
    const signOnHour = hour(body.signOnHour, current.signOnHour)
    const discoStartHour = hour(body.discoStartHour, current.discoStartHour)
    const discoEndHour = hour(body.discoEndHour, current.discoEndHour)
    const nightVolumeStartHour = hour(body.nightVolumeStartHour, current.nightVolumeStartHour)
    const nightVolumeEndHour = hour(body.nightVolumeEndHour, current.nightVolumeEndHour)
    const transmitterWatts: typeof current.transmitterWatts = typeof body.transmitterWatts === 'number' && [0, 5000, 20000, 100000].includes(body.transmitterWatts) ? body.transmitterWatts as typeof current.transmitterWatts : current.transmitterWatts
    if (body.rotationPoolSize !== undefined && (typeof body.rotationPoolSize !== 'number' || !Number.isInteger(body.rotationPoolSize) || body.rotationPoolSize < 50 || body.rotationPoolSize > 100)) return jsonError('Song rotation pool must be between 50 and 100.', 400)
    if (body.listenerLimit !== undefined && (typeof body.listenerLimit !== 'number' || !Number.isInteger(body.listenerLimit) || body.listenerLimit < 0 || body.listenerLimit > 1000)) return jsonError('Listener limit must be between 0 and 1,000; use 0 for unlimited.', 400)
    if (signOffHour === signOnHour) return jsonError('Sign-off and sign-on must be different.', 400)
    if (discoStartHour === discoEndHour) return jsonError('Disco start and end must be different.', 400)
    if (nightVolumeStartHour === nightVolumeEndHour) return jsonError('Night-volume start and end must be different.', 400)
    const next = {
      broadcastEnabled: typeof body.broadcastEnabled === 'boolean' ? body.broadcastEnabled : current.broadcastEnabled,
      autoDjEnabled: typeof body.autoDjEnabled === 'boolean' ? body.autoDjEnabled : current.autoDjEnabled,
      shuffleEnabled: typeof body.shuffleEnabled === 'boolean' ? body.shuffleEnabled : current.shuffleEnabled,
      goodVibesEnabled: typeof body.goodVibesEnabled === 'boolean' ? body.goodVibesEnabled : current.goodVibesEnabled,
      rotationPoolSize: typeof body.rotationPoolSize === 'number' ? body.rotationPoolSize : current.rotationPoolSize,
      listenerLimit: typeof body.listenerLimit === 'number' ? body.listenerLimit : current.listenerLimit,
      tagalogOnlyEnabled: typeof body.tagalogOnlyEnabled === 'boolean' ? body.tagalogOnlyEnabled : current.tagalogOnlyEnabled,
      transmitterWatts, signOffHour, signOnHour, discoStartHour, discoEndHour,
      christmasEnabled: typeof body.christmasEnabled === 'boolean' ? body.christmasEnabled : current.christmasEnabled,
      autoVoiceEnabled: typeof body.autoVoiceEnabled === 'boolean' ? body.autoVoiceEnabled : current.autoVoiceEnabled,
      autoVoiceAnnouncement: current.autoVoiceAnnouncement,
      djMicEnabled: typeof body.djMicEnabled === 'boolean' ? body.djMicEnabled : current.djMicEnabled,
      newsEnabled: typeof body.newsEnabled === 'boolean' ? body.newsEnabled : current.newsEnabled,
      nightVolumeEnabled: typeof body.nightVolumeEnabled === 'boolean' ? body.nightVolumeEnabled : current.nightVolumeEnabled,
      nightVolumeStartHour, nightVolumeEndHour,
      jingleEnabled: typeof body.jingleEnabled === 'boolean' ? body.jingleEnabled : current.jingleEnabled,
      commercialEnabled: typeof body.commercialEnabled === 'boolean' ? body.commercialEnabled : current.commercialEnabled,
      jingle: current.jingle, commercials: current.commercials, goldenSunday: current.goldenSunday, news: current.news, djMic: current.djMic,
    }
    await writeJson(SETTINGS_PATH, next)
    if (next.tagalogOnlyEnabled !== current.tagalogOnlyEnabled || next.goodVibesEnabled !== current.goodVibesEnabled || next.jingleEnabled !== current.jingleEnabled || next.commercialEnabled !== current.commercialEnabled || next.shuffleEnabled !== current.shuffleEnabled) await refreshQueue()
    return NextResponse.json(await getAdminStatus())
  } catch (error) {
    console.error('[morefm] admin settings PUT failed', error)
    return jsonError('Could not update admin settings.')
  }
}
export async function POST() {
  try {
    if (!(await isAdmin())) return jsonError('Unauthorized', 401)
    await refreshQueue()
    return NextResponse.json(await getAdminStatus())
  } catch (error) {
    console.error('[morefm] admin rotation refresh failed', error)
    return jsonError('Could not refresh rotation.')
  }
}
