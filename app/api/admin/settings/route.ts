import { type NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getAdminStatus, refreshQueue } from '@/lib/station'
import { getSettings, SETTINGS_PATH, writeJson } from '@/lib/storage'
import { MAX_BASS_BOOST_DB } from '@/lib/types'

const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } }

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore })
  return NextResponse.json(await getAdminStatus(), noStore)
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore })
  const body = (await request.json().catch(() => ({}))) as {
    broadcastEnabled?: unknown
    sundayScheduleEnabled?: unknown
    newTagalogOpmEnabled?: unknown
    bassBoostDb?: unknown
    transmitterWatts?: unknown
    blockedGenres?: unknown
    discoEnabled?: unknown
    rjOfficialAutoEnabled?: unknown
    rjOfficialAutoMessage?: unknown
  }
  const current = await getSettings()
  const blockedGenres = Array.isArray(body.blockedGenres)
    ? [...new Set(body.blockedGenres.filter((genre): genre is string => typeof genre === 'string').map((genre) => genre.trim().toLowerCase()).filter(Boolean))].slice(0, 30)
    : current.blockedGenres
  const next = {
    broadcastEnabled: typeof body.broadcastEnabled === 'boolean' ? body.broadcastEnabled : current.broadcastEnabled,
    sundayScheduleEnabled: typeof body.sundayScheduleEnabled === 'boolean'
      ? body.sundayScheduleEnabled
      : current.sundayScheduleEnabled,
    newTagalogOpmEnabled: typeof body.newTagalogOpmEnabled === 'boolean'
      ? body.newTagalogOpmEnabled
      : current.newTagalogOpmEnabled,
    bassBoostDb: typeof body.bassBoostDb === 'number' && Number.isFinite(body.bassBoostDb)
      ? Math.min(MAX_BASS_BOOST_DB, Math.max(0, body.bassBoostDb))
      : current.bassBoostDb,
    transmitterWatts: body.transmitterWatts === 5000 ? 5000 : body.transmitterWatts === 25000 ? 25000 : current.transmitterWatts,
    blockedGenres,
    discoEnabled: typeof body.discoEnabled === 'boolean' ? body.discoEnabled : current.discoEnabled,
    rjOfficialAutoEnabled: typeof body.rjOfficialAutoEnabled === 'boolean'
      ? body.rjOfficialAutoEnabled
      : current.rjOfficialAutoEnabled,
    rjOfficialAutoMessage: typeof body.rjOfficialAutoMessage === 'string'
      ? body.rjOfficialAutoMessage.trim().slice(0, 500)
      : current.rjOfficialAutoMessage,
  }
  await writeJson(SETTINGS_PATH, next)
  if ((typeof body.newTagalogOpmEnabled === 'boolean'
    && body.newTagalogOpmEnabled !== current.newTagalogOpmEnabled)
    || (Array.isArray(body.blockedGenres)
      && JSON.stringify(blockedGenres) !== JSON.stringify(current.blockedGenres))
    || (typeof body.discoEnabled === 'boolean' && body.discoEnabled !== current.discoEnabled)
  ) {
    await refreshQueue()
  }
  return NextResponse.json(await getAdminStatus(), noStore)
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore })
  await refreshQueue()
  return NextResponse.json(await getAdminStatus(), noStore)
}
