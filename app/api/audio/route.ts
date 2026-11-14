import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ALLOWED_HOST = /(^|\.)savetube\.vip$/i

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
    return NextResponse.json({ error: 'Audio source is not allowed.' }, { status: 403 })
  }

  try {
    const upstream = await fetch(target, {
      cache: 'no-store',
      headers: {
        Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.5',
        Referer: 'https://www.youtube.com/',
        'User-Agent': 'Mozilla/5.0 (compatible; MOR935AudioProxy/1.0)',
      },
      signal: AbortSignal.timeout(55_000),
    })
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'Audio source unavailable.' }, { status: 502 })
    }

    const headers = new Headers({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Type': upstream.headers.get('content-type')?.split(';')[0] || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
    })
    const length = upstream.headers.get('content-length')
    if (length) headers.set('Content-Length', length)
    return new Response(upstream.body, { status: 200, headers })
  } catch (error) {
    console.error('[morefm] audio proxy failed', error)
    return NextResponse.json({ error: 'Audio source unavailable.' }, { status: 502 })
  }
}
