import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { createAdminTimeCheck, getAdminTimeChecks } from '@/lib/station'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ items: await getAdminTimeChecks() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { prompt?: unknown; mode?: unknown }
  const requestedPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  const mode = body.mode === 'dzmm' ? 'dzmm' : body.mode === 'after3' ? 'after3' : null
  if (!mode) return NextResponse.json({ error: 'Choose when the time check should play.' }, { status: 400 })
  try {
    const prompt = requestedPrompt === 'AUTO_PH_TIME'
      ? `Generate RJ FM time check is ${new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date())}`
      : requestedPrompt
    if (!prompt) return NextResponse.json({ error: 'Philippine time check could not be generated.' }, { status: 400 })
    const item = await createAdminTimeCheck(prompt, mode)
    return NextResponse.json({ item, items: await getAdminTimeChecks() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not generate the time check.' }, { status: 400 })
  }
}
