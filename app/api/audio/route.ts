import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, no-transform' }

function isAllowedMediaUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && !url.port
      && /^cdn\d+\.savetube\.vip$/i.test(url.hostname)
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('src')
  if (!source || source.length > 4096 || !isAllowedMediaUrl(source)) {
    return NextResponse.json({ error: 'Invalid audio source.' }, { status: 400, headers: noStore })
  }

  try {
    const range = request.headers.get('range')
    const upstream = await fetch(source, {
      headers: range ? { Range: range } : undefined,
      cache: 'no-store',
      redirect: 'manual',
    })

    if (upstream.status >= 300 && upstream.status < 400) {
      return NextResponse.json({ error: 'Audio source redirect was rejected.' }, { status: 502, headers: noStore })
    }
    if (!upstream.ok && upstream.status !== 206 && upstream.status !== 416) {
      return NextResponse.json({ error: 'Audio source is unavailable.' }, { status: 502, headers: noStore })
    }

    const headers = new Headers(noStore)
    headers.set('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg')
    headers.set('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes')
    headers.set('X-Content-Type-Options', 'nosniff')
    for (const name of ['content-length', 'content-range']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }

    return new Response(upstream.body, { status: upstream.status, headers })
  } catch {
    return NextResponse.json({ error: 'Unable to load audio right now.' }, { status: 502, headers: noStore })
  }
}
