import { NextRequest, NextResponse } from 'next/server'
import { readJson, STATE_PATH } from '@/lib/storage'
import type { Track } from '@/lib/types'

export const dynamic = 'force-dynamic'
type HistoryEntry = { id: string; key: string; artist: string; t: number }
type State = { tracks?: Track[]; history?: HistoryEntry[] }

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const page = Math.max(1, Number(params.get('page') || 1))
  const limit = Math.min(100, Math.max(1, Number(params.get('limit') || 25)))
  const state = await readJson<State>(STATE_PATH, {})
  const records = (state.history || []).slice().reverse().map((h) => ({ id: h.id, artist: h.artist, playedAt: h.t, key: h.key }))
  const total = records.length, start = (page - 1) * limit
  return NextResponse.json({ page, limit, total, pages: Math.ceil(total / limit), songs: records.slice(start, start + limit) }, { headers: { 'Cache-Control': 'no-store' } })
}
