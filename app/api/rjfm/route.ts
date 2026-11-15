import { NextResponse } from 'next/server'
import { getRjfmSnapshot } from '@/lib/rjfm-online-radio'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const snapshot = await getRjfmSnapshot()
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] RJFM metadata unavailable', error)
    return NextResponse.json({ error: 'RJFM metadata unavailable' }, { status: 502 })
  }
}
