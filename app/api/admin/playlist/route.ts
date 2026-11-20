import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { enqueueSongRequest } from '@/lib/station'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { title?: string; artist?: string }
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : ''
  const artist = typeof body.artist === 'string' ? body.artist.trim().slice(0, 120) : ''
  if (!title || !artist) return NextResponse.json({ error: 'Title and artist are required.' }, { status: 400 })
  try {
    const result = await enqueueSongRequest(title, artist)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not queue song.' }, { status: 400 })
  }
}
