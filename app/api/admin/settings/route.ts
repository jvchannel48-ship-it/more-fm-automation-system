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
  const body = (await request.json().catch(() => ({}))) as { broadcastEnabled?: unknown; tagalogOnlyEnabled?: unknown; christmasEnabled?: unknown; classicLoveSongsEnabled?: unknown }
  const current = await getSettings()
  const requestedTagalogOnly = typeof body.tagalogOnlyEnabled === 'boolean' ? body.tagalogOnlyEnabled : current.tagalogOnlyEnabled
  const requestedClassicLove = typeof body.classicLoveSongsEnabled === 'boolean' ? body.classicLoveSongsEnabled : current.classicLoveSongsEnabled
  const tagalogOnlyEnabled = body.classicLoveSongsEnabled === true && body.tagalogOnlyEnabled !== true ? false : requestedTagalogOnly
  const classicLoveSongsEnabled = body.tagalogOnlyEnabled === true ? false : requestedClassicLove
  const next = {
    broadcastEnabled: typeof body.broadcastEnabled === 'boolean' ? body.broadcastEnabled : current.broadcastEnabled,
    tagalogOnlyEnabled,
    christmasEnabled: typeof body.christmasEnabled === 'boolean' ? body.christmasEnabled : current.christmasEnabled,
    classicLoveSongsEnabled,
  }
  await writeJson(SETTINGS_PATH, next)
  return NextResponse.json(await getAdminStatus(), noStore)
}

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore })
  await refreshQueue()
  return NextResponse.json(await getAdminStatus(), noStore)
}
