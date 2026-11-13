import { NextResponse } from 'next/server'
import { addSongRequest } from '@/lib/storage'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; artist?: unknown }
  const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : ''
  const artist = typeof body.artist === 'string' ? body.artist.trim().replace(/\s+/g, ' ') : ''
  if (title.length < 2 || title.length > 120 || artist.length < 2 || artist.length > 120) {
    return NextResponse.json({ error: 'Pakilagay ang valid na title at artist.' }, { status: 400 })
  }
  const songRequest = await addSongRequest(title, artist)
  return NextResponse.json({ request: songRequest, message: 'Salamat sa request! Isasama namin ito sa susunod na music rotation.' })
}
