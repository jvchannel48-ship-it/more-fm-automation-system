import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function POST() {
  return NextResponse.json({ error: 'Song requests are temporarily disabled.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } })
}
