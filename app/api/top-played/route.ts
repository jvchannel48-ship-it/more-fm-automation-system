import { NextResponse } from 'next/server'
import { getTopPlayed } from '@/lib/radio-catalog'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const songs = await getTopPlayed(25)
    return NextResponse.json({ songs }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] top-played query failed', error)
    return NextResponse.json({ songs: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
