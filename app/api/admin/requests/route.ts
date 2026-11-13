import { type NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getSongRequests, updateSongRequest } from '@/lib/storage'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const requests = await getSongRequests()
  return NextResponse.json({ requests: requests.sort((a, b) => b.requestedAt - a.requestedAt) })
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; status?: unknown }
  if (typeof body.id !== 'string' || !['played', 'skipped', 'pending'].includes(String(body.status))) {
    return NextResponse.json({ error: 'Invalid request update.' }, { status: 400 })
  }
  const updated = await updateSongRequest(body.id, body.status as 'played' | 'skipped' | 'pending')
  if (!updated) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  return NextResponse.json({ request: updated })
}
