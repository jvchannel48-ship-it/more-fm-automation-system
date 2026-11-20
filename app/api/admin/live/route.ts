import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { LIVE_DJ_PATH, readJson, writeJson } from '@/lib/storage'
import type { LiveDjState } from '@/lib/types'

export const dynamic = 'force-dynamic'

const EMPTY: LiveDjState = { active: false, name: '', updatedAt: 0 }

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const state = await readJson<LiveDjState>(LIVE_DJ_PATH, EMPTY)
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { active?: boolean; name?: string; stationId?: string }
  const current = await readJson<LiveDjState>(LIVE_DJ_PATH, EMPTY)
  const next: LiveDjState = {
    active: body.active === true,
    name: typeof body.name === 'string' ? body.name.trim().slice(0, 40) : current.name,
    stationId: typeof body.stationId === 'string' ? body.stationId.slice(0, 32) : current.stationId,
    updatedAt: Date.now(),
  }
  if (!next.name) next.name = 'Live DJ'
  await writeJson(LIVE_DJ_PATH, next)
  return NextResponse.json(next)
}
