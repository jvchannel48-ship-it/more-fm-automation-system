import { type NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getSongRequests, updateSongRequest } from '@/lib/storage'
export const dynamic = 'force-dynamic'

const jsonError = (error: string, status = 500) => NextResponse.json({ error }, { status })

export async function GET() {
  try {
    if (!(await isAdmin())) return jsonError('Unauthorized', 401)
    const requests = await getSongRequests()
    return NextResponse.json({ requests: requests.sort((a, b) => b.requestedAt - a.requestedAt) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] admin song request list failed', error)
    return jsonError('Could not load song requests.')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await isAdmin())) return jsonError('Unauthorized', 401)
    const body = (await request.json().catch(() => ({}))) as { id?: unknown; status?: unknown }
    if (typeof body.id !== 'string' || !['played', 'skipped', 'pending'].includes(String(body.status))) {
      return jsonError('Invalid request update.', 400)
    }
    const updated = await updateSongRequest(body.id, body.status as 'played' | 'skipped' | 'pending')
    if (!updated) return jsonError('Request not found.', 404)
    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error('[morefm] admin song request update failed', error)
    return jsonError('Could not update song request.')
  }
}
