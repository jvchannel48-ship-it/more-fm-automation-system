import { NextRequest, NextResponse } from 'next/server'
import { queueSongRequest } from '@/lib/station'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { artist?: unknown; title?: unknown }
  const artist = typeof body.artist === 'string' ? body.artist.trim().slice(0, 80) : ''
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : ''

  if (artist.length < 2 || title.length < 2) {
    return NextResponse.json({ error: 'Ilagay ang artist at song title.' }, { status: 400 })
  }

  try {
    const result = await queueSongRequest(artist, title)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[rjfm] song request failed', error)
    return NextResponse.json({ error: 'Hindi na-save ang request. Subukan ulit.' }, { status: 500 })
  }
}
