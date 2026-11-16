import { type NextRequest, NextResponse } from 'next/server'
import { addRating, getRatings } from '@/lib/storage'

export async function GET() {
  try {
    const ratings = await getRatings()
    return NextResponse.json({ total: ratings.total })
  } catch (error) {
    console.error('[morefm] rating summary failed', error)
    return NextResponse.json({ error: 'Could not load ratings.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { voterId?: unknown }
    const voterId = typeof body.voterId === 'string' ? body.voterId.trim().slice(0, 120) : ''
    if (!voterId) return NextResponse.json({ error: 'Missing voter id.' }, { status: 400 })
    const current = await getRatings()
    if (current.voterIds.includes(voterId)) return NextResponse.json({ total: current.total, alreadyRated: true })
    const ratings = await addRating(voterId)
    return NextResponse.json({ total: ratings.total, alreadyRated: false })
  } catch (error) {
    console.error('[morefm] rating save failed', error)
    return NextResponse.json({ error: 'Could not save your rating.' }, { status: 500 })
  }
}
