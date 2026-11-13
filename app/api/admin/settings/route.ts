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
    signOffHour?: unknown
    signOnHour?: unknown
    jingleEnabled?: unknown
    commercialEnabled?: unknown
  }
  const current = await getSettings()
  const signOffHour = typeof body.signOffHour === 'number' && body.signOffHour >= 0 && body.signOffHour <= 23 ? body.signOffHour : current.signOffHour
  const signOnHour = typeof body.signOnHour === 'number' && body.signOnHour >= 0 && body.signOnHour <= 23 ? body.signOnHour : current.signOnHour
  if (signOffHour === signOnHour) return NextResponse.json({ error: 'Magkaiba dapat ang sign-off at sign-on time.' }, { status: 400 })
  const next = {
    broadcastEnabled: typeof body.broadcastEnabled === 'boolean' ? body.broadcastEnabled : current.broadcastEnabled,
    signOffHour,
    signOnHour,
    jingleEnabled: typeof body.jingleEnabled === 'boolean' ? body.jingleEnabled : current.jingleEnabled,
    commercialEnabled: typeof body.commercialEnabled === 'boolean' ? body.commercialEnabled : current.commercialEnabled,
    jingle: current.jingle,
    commercials: current.commercials,
    goldenSunday: current.goldenSunday,
  }
  await writeJson(SETTINGS_PATH, next)
  return NextResponse.json(await getAdminStatus())
}

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await refreshQueue()
  return NextResponse.json(await getAdminStatus())
}
