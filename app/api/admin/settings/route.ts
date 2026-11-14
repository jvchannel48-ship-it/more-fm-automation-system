import { type NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getAdminStatus, refreshQueue } from '@/lib/station'
import { getSettings, hasPersistentStorage, hasSettingsPersistence, SETTINGS_PATH, writeJson } from '@/lib/storage'
export const dynamic = 'force-dynamic'
const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } }
const jsonError = (message: string, status = 500) => NextResponse.json({ error: message }, { status, ...noStore })
export async function GET() {
  try {
    if (!(await isAdmin())) return jsonError('Unauthorized', 401)
    return NextResponse.json({ ...await getAdminStatus(), persistenceConfigured: hasSettingsPersistence }, noStore)
  } catch (error) {
    console.error('[morefm] admin settings GET failed', error)
    return jsonError(hasSettingsPersistence && !hasPersistentStorage
      ? 'Could not load admin settings from Supabase Storage. Check SUPABASE_URL, the server-only service-role key, and private bucket access.'
      : hasPersistentStorage
        ? 'Could not load admin settings: the configured POSTGRES_URL could not connect to Supabase PostgreSQL. Verify the URL, database password, network access, and applied migrations.'
        : 'Could not load admin settings.')
  }
}
export async function PUT(request: NextRequest) {
  try {
    if (!(await isAdmin())) return jsonError('Unauthorized', 401)
    const body = (await request.json().catch(() => ({}))) as {
      broadcastEnabled?: unknown; boardOperatorEnabled?: unknown; noRepeatEnabled?: unknown; autoDjEnabled?: unknown; morSyncEnabled?: unknown; shuffleEnabled?: unknown; goodVibesEnabled?: unknown; rotationPoolSize?: unknown; listenerLimit?: unknown; tagalogOnlyEnabled?: unknown; transmitterWatts?: unknown
      signOffHour?: unknown; signOnHour?: unknown; discoStartHour?: unknown; discoEndHour?: unknown
      christmasEnabled?: unknown; autoVoiceEnabled?: unknown; djMicEnabled?: unknown; newsEnabled?: unknown; nightVolumeEnabled?: unknown
      nightVolumeStartHour?: unknown; nightVolumeEndHour?: unknown; jingleEnabled?: unknown; commercialEnabled?: unknown
      masterVolume?: unknown; nightVolumePercent?: unknown; bassGainDb?: unknown; crossfaderEnabled?: unknown; crossfaderCurve?: unknown; crossfadeSeconds?: unknown; replayGainEnabled?: unknown; replayGainTargetLufs?: unknown
    }
    const current = await getSettings()
    const hour = (value: unknown, fallback: number) => typeof value === 'number' && value >= 0 && value <= 23 ? value : fallback
    const signOffHour = 1
    const signOnHour = 4
    const discoStartHour = 16
    const discoEndHour = 19
    const nightVolumeStartHour = hour(body.nightVolumeStartHour, current.nightVolumeStartHour)
    const nightVolumeEndHour = hour(body.nightVolumeEndHour, current.nightVolumeEndHour)
    const bounded = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
    const crossfaderCurves = ['transition', 'smooth', 'constant-power', 'dipped', 'slow-fade', 'slow-cut', 'fast-fade', 'fast-cut', 'full-cut', 'scratch-cut'] as const
    const masterVolume = 80
    const nightVolumePercent = 70
    const bassGainDb = 12
    const crossfadeSeconds = bounded(body.crossfadeSeconds, current.crossfadeSeconds, 0, 30)
    const replayGainTargetLufs = bounded(body.replayGainTargetLufs, current.replayGainTargetLufs, -24, -5)
    const transmitterWatts: typeof current.transmitterWatts = typeof body.transmitterWatts === 'number' && [0, 5000, 20000, 100000].includes(body.transmitterWatts) ? body.transmitterWatts as typeof current.transmitterWatts : current.transmitterWatts
    if (body.rotationPoolSize !== undefined && (typeof body.rotationPoolSize !== 'number' || !Number.isInteger(body.rotationPoolSize) || body.rotationPoolSize < 50 || body.rotationPoolSize > 300)) return jsonError('Song rotation pool must be between 50 and 300.', 400)
    if (body.listenerLimit !== undefined && (typeof body.listenerLimit !== 'number' || !Number.isInteger(body.listenerLimit) || body.listenerLimit < 0 || body.listenerLimit > 1000)) return jsonError('Listener limit must be between 0 and 1,000; use 0 for unlimited.', 400)
    if (signOffHour === signOnHour) return jsonError('Sign-off and sign-on must be different.', 400)
    if (discoStartHour === discoEndHour) return jsonError('Disco start and end must be different.', 400)
    if (nightVolumeStartHour === nightVolumeEndHour) return jsonError('Night-volume start and end must be different.', 400)
    const next = {
      broadcastEnabled: typeof body.broadcastEnabled === 'boolean' ? body.broadcastEnabled : current.broadcastEnabled,
      boardOperatorEnabled: typeof body.boardOperatorEnabled === 'boolean' ? body.boardOperatorEnabled : current.boardOperatorEnabled,
      noRepeatEnabled: true,
      autoDjEnabled: typeof body.autoDjEnabled === 'boolean' ? body.autoDjEnabled : current.autoDjEnabled,
      morSyncEnabled: typeof body.morSyncEnabled === 'boolean' ? body.morSyncEnabled : current.morSyncEnabled,
      shuffleEnabled: typeof body.shuffleEnabled === 'boolean' ? body.shuffleEnabled : current.shuffleEnabled,
      goodVibesEnabled: typeof body.goodVibesEnabled === 'boolean' ? body.goodVibesEnabled : current.goodVibesEnabled,
      rotationPoolSize: typeof body.rotationPoolSize === 'number' ? body.rotationPoolSize : current.rotationPoolSize,
      listenerLimit: 0,
      tagalogOnlyEnabled: typeof body.tagalogOnlyEnabled === 'boolean' ? body.tagalogOnlyEnabled : current.tagalogOnlyEnabled,
      transmitterWatts, signOffHour, signOnHour, discoStartHour, discoEndHour,
      masterVolume, nightVolumePercent, bassGainDb,
      crossfaderEnabled: typeof body.crossfaderEnabled === 'boolean' ? body.crossfaderEnabled : current.crossfaderEnabled,
      crossfaderCurve: crossfaderCurves.includes(body.crossfaderCurve as typeof crossfaderCurves[number]) ? body.crossfaderCurve as typeof crossfaderCurves[number] : current.crossfaderCurve,
      crossfadeSeconds, replayGainEnabled: typeof body.replayGainEnabled === 'boolean' ? body.replayGainEnabled : current.replayGainEnabled, replayGainTargetLufs,
      christmasEnabled: false,
      autoVoiceEnabled: false,
      autoVoiceAnnouncement: current.autoVoiceAnnouncement,
      djMicEnabled: typeof body.djMicEnabled === 'boolean' ? body.djMicEnabled : current.djMicEnabled,
      newsEnabled: typeof body.newsEnabled === 'boolean' ? body.newsEnabled : current.newsEnabled,
      nightVolumeEnabled: true,
      nightVolumeStartHour: 22, nightVolumeEndHour: 6,
      jingleEnabled: typeof body.jingleEnabled === 'boolean' ? body.jingleEnabled : current.jingleEnabled,
      commercialEnabled: typeof body.commercialEnabled === 'boolean' ? body.commercialEnabled : current.commercialEnabled,
      jingle: current.jingle, commercials: current.commercials, goldenSunday: current.goldenSunday, news: current.news, djMic: current.djMic,
    }
    await writeJson(SETTINGS_PATH, next)
    if (next.morSyncEnabled !== current.morSyncEnabled || next.tagalogOnlyEnabled !== current.tagalogOnlyEnabled || next.goodVibesEnabled !== current.goodVibesEnabled || next.jingleEnabled !== current.jingleEnabled || next.commercialEnabled !== current.commercialEnabled || next.shuffleEnabled !== current.shuffleEnabled || next.noRepeatEnabled !== current.noRepeatEnabled || next.crossfaderEnabled !== current.crossfaderEnabled || next.crossfadeSeconds !== current.crossfadeSeconds) await refreshQueue()
    return NextResponse.json({ ...await getAdminStatus(), persistenceConfigured: hasSettingsPersistence }, noStore)
  } catch (error) {
    console.error('[morefm] admin settings PUT failed', error)
    const message = error instanceof Error && error.message.includes('No persistent settings backend is configured')
      ? 'Cannot save admin settings: configure POSTGRES_URL, or Supabase Storage with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then redeploy.'
      : (error instanceof Error && error.message.includes('Supabase Storage')) || (hasSettingsPersistence && !hasPersistentStorage)
        ? 'Cannot save admin settings: Supabase Storage could not save or prepare the private settings file. Check SUPABASE_URL, the service-role key, and bucket permissions.'
        : hasPersistentStorage
          ? 'Could not update admin settings: POSTGRES_URL is present but Supabase PostgreSQL could not be reached. Verify the connection string and database migrations.'
          : 'Could not update admin settings. Please retry.'
    return jsonError(message)
  }
}
export async function POST() {
  try {
    if (!(await isAdmin())) return jsonError('Unauthorized', 401)
    await refreshQueue()
    return NextResponse.json({ ...await getAdminStatus(), persistenceConfigured: hasSettingsPersistence }, noStore)
  } catch (error) {
    console.error('[morefm] admin rotation refresh failed', error)
    return jsonError(hasPersistentStorage
      ? 'Could not refresh rotation: the configured POSTGRES_URL could not connect to Supabase PostgreSQL.'
      : 'Could not refresh rotation.')
  }
}
