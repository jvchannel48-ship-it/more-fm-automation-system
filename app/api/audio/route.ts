import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const noStore = { 'Cache-Control': 'private, no-store, no-transform' }

/** Allow known music CDNs + DZMM live. Follow redirects so MP3 actually plays. */
function isAllowedMediaUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    const host = url.hostname.toLowerCase()

    if (host === 'us1.amfmph.com' && url.port === '8852' && url.pathname === '/live') return true
    if (url.port) return false

    if (
      /^cdn\d+\.savetube\.vip$/i.test(host) ||
      /(^|\.)savetube\.(vip|me|io|com)$/i.test(host) ||
      /(^|\.)save\.tube$/i.test(host) ||
      /(^|\.)rapidcdn\./i.test(host) ||
      /(^|\.)ytmp3\./i.test(host) ||
      /(^|\.)y2mate\./i.test(host) ||
      host.endsWith('googlevideo.com')
    ) {
      return true
    }
    return false
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
      headers: {
        ...(range ? { Range: range } : {}),
        Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.5',
        Referer: 'https://www.youtube.com/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(55_000),
    })

    if (!upstream.ok && upstream.status !== 206 && upstream.status !== 416) {
      return NextResponse.json({ error: 'Audio source is unavailable.' }, { status: 502, headers: noStore })
    }

    const contentType = (upstream.headers.get('content-type') || 'audio/mpeg').split(';')[0]
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Audio source is unavailable.' }, { status: 502, headers: noStore })
    }

    const headers = new Headers(noStore)
    headers.set('Content-Type', contentType || 'audio/mpeg')
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
