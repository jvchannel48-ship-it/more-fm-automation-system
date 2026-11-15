import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Allow media hosts from song download providers. Keep broad so a strong
// listener connection is not blocked by a rotating CDN hostname.
const ALLOWED_HOST = /(^|\.)(savetube\.vip|savetube\.me|savetube\.io|save\.tube|cdn\.savetube\.|rapidcdn\.|ytmp3\.|y2mate\.|googlevideo\.com|googleusercontent\.com|cdn\.|cloudfront\.net|akamaized\.net|fastly|b-cdn\.net)$/i

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get('url')
  if (!rawUrl) return NextResponse.json({ error: 'Missing audio URL.' }, { status: 400 })

  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid audio URL.' }, { status: 400 })
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOST.test(target.hostname)) {
    console.warn('[morefm] blocked audio host', target.hostname)
    return NextResponse.json({ error: 'Audio source is not allowed.' }, { status: 403 })
  }

  try {
    const range = request.headers.get('range')
    const upstream = await fetch(target, {
      cache: 'no-store',
      headers: {
        Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.5',
        Referer: 'https://www.youtube.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(range ? { Range: range } : {}),
      },
      redirect: 'follow',
    })
    if (!upstream.ok || !upstream.body) {
      console.error('[morefm] upstream audio unavailable', target.hostname, upstream.status)
      return NextResponse.json({ error: 'Audio source unavailable.' }, { status: 502 })
    }

    const contentType = upstream.headers.get('content-type')?.split(';')[0] || 'audio/mpeg'
    // Reject HTML/error responses instead of passing them to the audio element.
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      console.error('[morefm] upstream returned non-audio content-type', contentType, target.hostname)
      return NextResponse.json({ error: 'Audio source unavailable.' }, { status: 502 })
    }

    const headers = new Headers({
      'Cache-Control': 'public, max-age=3600, immutable',
      'Content-Type': contentType,
      'Accept-Ranges': upstream.headers.get('accept-ranges') ?? 'bytes',
      'Content-Disposition': 'inline',
      'Vary': 'Range',
    })
    for (const name of ['content-length', 'content-range', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
  } catch (error) {
    console.error('[morefm] audio proxy failed', target.hostname, error)
    return NextResponse.json({ error: 'Audio source unavailable.' }, { status: 502 })
  }
}
