import { NextResponse } from 'next/server'
import { list, del } from '@vercel/blob'
import { isAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (body.confirm !== 'DELETE_ALL_MP3') return NextResponse.json({ error: 'Explicit confirmation required' }, { status: 400 })
  try {
    let cursor: string | undefined
    let deleted = 0
    do {
      const result = await list({ cursor, limit: 1000 })
      const mp3s = result.blobs.filter((b) => /\.mp3(?:$|\?)/i.test(b.pathname) || /\.mp3(?:$|\?)/i.test(b.url))
      if (mp3s.length) { await del(mp3s.map((b) => b.url)); deleted += mp3s.length }
      cursor = result.hasMore ? result.cursor : undefined
    } while (cursor)
    return NextResponse.json({ ok: true, deleted })
  } catch (error) {
    console.error('[clean-blob] failed', error)
    return NextResponse.json({ error: 'Blob cleanup failed' }, { status: 500 })
  }
}
