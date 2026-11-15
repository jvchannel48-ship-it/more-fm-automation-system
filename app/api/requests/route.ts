import { NextResponse } from 'next/server'
import { submitSongRequest } from '@/lib/station'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { name?: unknown; song_title?: unknown; title?: unknown; artist?: unknown } | null
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''
    const titleValue = body?.song_title ?? body?.title
    const title = typeof titleValue === 'string' ? titleValue.trim().slice(0, 200) : ''
    const artist = typeof body?.artist === 'string' ? body.artist.trim().slice(0, 120) : ''
    if (!name || !title || !artist) {
      return NextResponse.json({ error: 'Enter your name, song title, and artist.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }
    const result = await submitSongRequest(title, artist, name)
    const reason = result.reason?.replace(/AutoDJ/gi, 'station queue')
    return NextResponse.json({ ...result, reason }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] song request failed', error)
    return NextResponse.json({ error: 'The song request could not be saved.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
