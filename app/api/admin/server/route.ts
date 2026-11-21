import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { pingDatabase } from '@/lib/db'
import { getSettings, isBlobStorageAvailable } from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Admin login required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  // Read the configured settings object so storage health reflects the latest read attempt.
  await getSettings()
  const database = await pingDatabase()
  const memory = process.memoryUsage()

  return NextResponse.json({
    server: { status: 'online', uptimeSeconds: Math.floor(process.uptime()), checkedAt: Date.now() },
    database,
    storage: { configured: isBlobStorageAvailable(), provider: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Supabase Storage' : 'Blob storage' },
    memory: { heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024), heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024), rssMb: Math.round(memory.rss / 1024 / 1024) },
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
