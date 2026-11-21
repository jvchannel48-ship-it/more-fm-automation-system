import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Lightweight no-cache endpoint used by the in-app RJ FM round-trip ping tool. */
export async function GET() {
  return NextResponse.json(
    { ok: true, timestamp: Date.now() },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  )
}
