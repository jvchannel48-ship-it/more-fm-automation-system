import { type NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getAdminStatus, refreshQueue } from '@/lib/station'
import { getSettings, SETTINGS_PATH, writeJson } from '@/lib/storage'

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
    edgeTtsEnabled?: unknown
  }
  const current = await getSettings()
  const next = {
    broadcastEnabled: typeof body.broadcastEnabled === 'boolean' ? body.broadcastEnabled : current.broadcastEnabled,
    sundayScheduleEnabled: typeof body.sundayScheduleEnabled === 'boolean'
      ? body.sundayScheduleEnabled
      : current.sundayScheduleEnabled,
    newTagalogOpmEnabled: typeof body.newTagalogOpmEnabled === 'boolean'
      ? body.newTagalogOpmEnabled
      : current.newTagalogOpmEnabled,
    bassBoostDb: typeof body.bassBoostDb === 'number' && Number.isFinite(body.bassBoostDb)
      ? Math.min(14, Math.max(0, body.bassBoostDb))
      : current.bassBoostDb,
    edgeTtsEnabled: typeof body.edgeTtsEnabled === 'boolean' ? body.edgeTtsEnabled : current.edgeTtsEnabled,
  }
  await writeJson(SETTINGS_PATH, next)
  if ((typeof body.newTagalogOpmEnabled === 'boolean'
    && body.newTagalogOpmEnabled !== current.newTagalogOpmEnabled)
    || (typeof body.edgeTtsEnabled === 'boolean' && body.edgeTtsEnabled !== current.edgeTtsEnabled)) {
    await refreshQueue()
  }
  return NextResponse.json(await getAdminStatus(), noStore)
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore })
  await refreshQueue()
  return NextResponse.json(await getAdminStatus(), noStore)
}
