import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getStorageUsage } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ usage: await getStorageUsage() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] admin storage usage failed', error)
    return NextResponse.json({ error: 'Could not read Supabase storage usage.' }, { status: 503 })
  }
}
