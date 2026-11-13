import { NextResponse } from 'next/server'
import { addSongRequest } from '@/lib/storage'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; artist?: unknown }
  const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : ''
  const artist = typeof body.artist === 'string' ? body.artist.trim().replace(/\s+/g, ' ') : ''
  if (title.length < 2 || title.length > 120 || artist.length < 2 || artist.length > 120) {
    return NextResponse.json({ error: 'Please enter a valid song title and artist.' }, { status: 400 })
  }
  const songRequest = await addSongRequest(title, artist)
  return NextResponse.json({ request: songRequest, message: 'Your request has been received and is being checked. If a suitable version is available, it will be queued for the next available slot after songs already playing or queued. Please wait; it may take a little while to come on.' })
}
