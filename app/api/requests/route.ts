import { type NextRequest, NextResponse } from 'next/server'
import { enqueueSongRequest } from '@/lib/station'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; artist?: unknown }
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const artist = typeof body.artist === 'string' ? body.artist.trim() : ''

  if (!title || !artist) return NextResponse.json({ error: 'Ilagay ang song title at artist.' }, { status: 400 })
  if (title.length > 120 || artist.length > 120) return NextResponse.json({ error: 'Hanggang 120 characters lang bawat field.' }, { status: 400 })

  try {
    const result = await enqueueSongRequest(title, artist)
    return NextResponse.json(result, { status: 202, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] song request failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Hindi mahanap ang requested song ngayon.' },
      { status: 422, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
