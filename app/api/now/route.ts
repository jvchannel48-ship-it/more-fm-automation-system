import { NextResponse } from 'next/server'
import { getNowPlaying } from '@/lib/station'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    const data = await getNowPlaying()
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] now playing failed', error)
    return NextResponse.json({ error: 'Station unavailable' }, { status: 500 })
  }
}
