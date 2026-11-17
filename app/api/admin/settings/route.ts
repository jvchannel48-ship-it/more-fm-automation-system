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
  const body = (await request.json().catch(() => ({}))) as { broadcastEnabled?: unknown }
  const current = await getSettings()
  const next = {
    broadcastEnabled: typeof body.broadcastEnabled === 'boolean' ? body.broadcastEnabled : current.broadcastEnabled,
  }
  await writeJson(SETTINGS_PATH, next)
  return NextResponse.json(await getAdminStatus(), noStore)
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore })
  const body = (await request.json().catch(() => ({}))) as { mode?: unknown }
  const mode = body.mode === 'new-tagalog' ? 'new-tagalog' : 'rotation'
  await refreshQueue(mode)
  return NextResponse.json(await getAdminStatus(), noStore)
}
