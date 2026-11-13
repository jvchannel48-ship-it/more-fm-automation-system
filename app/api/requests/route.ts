import { NextResponse } from 'next/server'
import { addSongRequest } from '@/lib/storage'
import { prioritizePendingRequests } from '@/lib/station'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { title?: unknown; artist?: unknown }
    const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : ''
    const artist = typeof body.artist === 'string' ? body.artist.trim().replace(/\s+/g, ' ') : ''
    if (title.length < 2 || title.length > 120 || artist.length < 2 || artist.length > 120) {
      return NextResponse.json({ error: 'Please enter a valid song title and artist.' }, { status: 400 })
    }
    const songRequest = await addSongRequest(title, artist)
    await prioritizePendingRequests()
    return NextResponse.json({
      request: songRequest,
      message: 'Your request has been received. The current song will finish, then pending requests are checked in order and played ahead of the regular rotation when a suitable version is available.',
    })
  } catch (error) {
    console.error('[morefm] song request save failed', error)
    return NextResponse.json({ error: 'Could not save your song request. Please try again.' }, { status: 500 })
  }
}
