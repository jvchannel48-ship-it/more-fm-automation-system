import { NextRequest, NextResponse } from 'next/server'
import { submitSongRequest } from '@/lib/station'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { title?: unknown; artist?: unknown }
    const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ').slice(0, 160) : ''
    const artist = typeof body.artist === 'string' ? body.artist.trim().replace(/\s+/g, ' ').slice(0, 120) : ''
    if (title.length < 2 || artist.length < 2) {
      return NextResponse.json({ error: 'Enter both a song title and artist.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }
    const result = await submitSongRequest(title, artist)
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] public song request failed', error)
    return NextResponse.json({ error: 'Your request was saved, but AutoDJ could not process it yet. Please try again later.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
