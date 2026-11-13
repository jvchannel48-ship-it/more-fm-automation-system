import { type NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getAdminStatus, refreshQueue } from '@/lib/station'
import { getSettings, SETTINGS_PATH, writeJson } from '@/lib/storage'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await getAdminStatus())
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as {
    broadcastEnabled?: unknown
    autoDjEnabled?: unknown
    tagalogOnlyEnabled?: unknown
    transmitterWatts?: unknown
    signOffHour?: unknown
    signOnHour?: unknown
    discoStartHour?: unknown
    discoEndHour?: unknown
    christmasEnabled?: unknown
    djMicEnabled?: unknown
    newsEnabled?: unknown
    nightVolumeEnabled?: unknown
    nightVolumeStartHour?: unknown
    nightVolumeEndHour?: unknown
    jingleEnabled?: unknown
    commercialEnabled?: unknown
  }
  const current = await getSettings()
  const signOffHour = typeof body.signOffHour === 'number' && body.signOffHour >= 0 && body.signOffHour <= 23 ? body.signOffHour : current.signOffHour
  const signOnHour = typeof body.signOnHour === 'number' && body.signOnHour >= 0 && body.signOnHour <= 23 ? body.signOnHour : current.signOnHour
  const discoStartHour = typeof body.discoStartHour === 'number' && body.discoStartHour >= 0 && body.discoStartHour <= 23 ? body.discoStartHour : current.discoStartHour
  const discoEndHour = typeof body.discoEndHour === 'number' && body.discoEndHour >= 0 && body.discoEndHour <= 23 ? body.discoEndHour : current.discoEndHour
  const nightVolumeStartHour = typeof body.nightVolumeStartHour === 'number' && body.nightVolumeStartHour >= 0 && body.nightVolumeStartHour <= 23 ? body.nightVolumeStartHour : current.nightVolumeStartHour
  const nightVolumeEndHour = typeof body.nightVolumeEndHour === 'number' && body.nightVolumeEndHour >= 0 && body.nightVolumeEndHour <= 23 ? body.nightVolumeEndHour : current.nightVolumeEndHour
  const transmitterWatts: typeof current.transmitterWatts = typeof body.transmitterWatts === 'number' && [0, 5000, 20000, 100000].includes(body.transmitterWatts) ? body.transmitterWatts as typeof current.transmitterWatts : current.transmitterWatts
  if (signOffHour === signOnHour) return NextResponse.json({ error: 'Sign-off and sign-on must be different.' }, { status: 400 })
  if (discoStartHour === discoEndHour) return NextResponse.json({ error: 'Disco start and end must be different.' }, { status: 400 })
  if (nightVolumeStartHour === nightVolumeEndHour) return NextResponse.json({ error: 'Night-volume start and end must be different.' }, { status: 400 })
  const next = {
    broadcastEnabled: typeof body.broadcastEnabled === 'boolean' ? body.broadcastEnabled : current.broadcastEnabled,
    autoDjEnabled: typeof body.autoDjEnabled === 'boolean' ? body.autoDjEnabled : current.autoDjEnabled,
    tagalogOnlyEnabled: typeof body.tagalogOnlyEnabled === 'boolean' ? body.tagalogOnlyEnabled : current.tagalogOnlyEnabled,
    transmitterWatts,
    signOffHour,
    signOnHour,
    discoStartHour,
    discoEndHour,
    christmasEnabled: typeof body.christmasEnabled === 'boolean' ? body.christmasEnabled : current.christmasEnabled,
    djMicEnabled: typeof body.djMicEnabled === 'boolean' ? body.djMicEnabled : current.djMicEnabled,
    newsEnabled: typeof body.newsEnabled === 'boolean' ? body.newsEnabled : current.newsEnabled,
    nightVolumeEnabled: typeof body.nightVolumeEnabled === 'boolean' ? body.nightVolumeEnabled : current.nightVolumeEnabled,
    nightVolumeStartHour,
    nightVolumeEndHour,
    jingleEnabled: typeof body.jingleEnabled === 'boolean' ? body.jingleEnabled : current.jingleEnabled,
    commercialEnabled: typeof body.commercialEnabled === 'boolean' ? body.commercialEnabled : current.commercialEnabled,
    jingle: current.jingle,
    commercials: current.commercials,
    goldenSunday: current.goldenSunday,
    news: current.news,
    djMic: current.djMic,
  }
  await writeJson(SETTINGS_PATH, next)
  if (next.tagalogOnlyEnabled !== current.tagalogOnlyEnabled) await refreshQueue()
  return NextResponse.json(await getAdminStatus())
}

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await refreshQueue()
  return NextResponse.json(await getAdminStatus())
}
