import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getPostgresPool, getStorageUsage } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!getPostgresPool()) return NextResponse.json({ usage: null, unavailable: true }, { headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json({ usage: await getStorageUsage() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] admin storage usage failed', error)
    return NextResponse.json({ usage: null, unavailable: true, error: 'Storage usage is unavailable for this deployment.' }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
