import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { MESSAGES_PATH, readJson, writeJson } from '@/lib/storage'
import type { ListenerMessage } from '@/lib/types'

export const dynamic = 'force-dynamic'

const MAX_MESSAGES = 100

export async function GET() {
  const list = await readJson<ListenerMessage[]>(MESSAGES_PATH, [])
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ messages: list.slice(0, MAX_MESSAGES) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { fromName?: string; body?: string; id?: string; action?: string }
  const admin = await isAdmin()

  if (admin && body.action === 'mark-read') {
    const list = await readJson<ListenerMessage[]>(MESSAGES_PATH, [])
    const next = list.map((item) => item.id === body.id ? { ...item, read: true } : item)
    await writeJson(MESSAGES_PATH, next)
    return NextResponse.json({ messages: next })
  }

  if (admin && body.action === 'clear') {
    await writeJson(MESSAGES_PATH, [])
    return NextResponse.json({ messages: [] })
  }

  const fromName = typeof body.fromName === 'string' ? body.fromName.trim().slice(0, 40) : 'Listener'
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 500) : ''
  if (!text) return NextResponse.json({ error: 'Message is required.' }, { status: 400 })

  const list = await readJson<ListenerMessage[]>(MESSAGES_PATH, [])
  const message: ListenerMessage = {
    id: crypto.randomUUID(),
    fromName: fromName || 'Listener',
    body: text,
    createdAt: Date.now(),
    read: false,
  }
  const next = [message, ...list].slice(0, MAX_MESSAGES)
  await writeJson(MESSAGES_PATH, next)
  return NextResponse.json({ ok: true, id: message.id })
}
