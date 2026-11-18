import { NextResponse } from 'next/server'
import { isDatabaseConfigured, pingDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Public diagnostic: is Render Postgres reachable from this service? */
export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error:
          'Render Postgres is not connected. Set DATABASE_URL to the database Internal URL in the Render web service environment.',
        hint: 'Render → more-fm-automation-system → Environment → DATABASE_URL = Internal URL from mor-naga-db',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const result = await pingDatabase()
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        error: result.error,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return NextResponse.json(
    { ok: true, configured: true, database: 'connected' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
