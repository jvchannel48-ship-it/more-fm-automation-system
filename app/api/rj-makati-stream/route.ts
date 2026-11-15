const RJ_MAKATI_STREAM_URL = 'https://stream.zeno.fm/as29d8g0g4duv'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    const upstream = await fetch(RJ_MAKATI_STREAM_URL, {
      cache: 'no-store',
      headers: {
        Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.5',
        'Icy-MetaData': '1',
        'User-Agent': 'VLC/3.0.20',
      },
      redirect: 'follow',
    })
    if (!upstream.ok || !upstream.body) {
      console.error('[morefm] RJFM Makati upstream unavailable', upstream.status)
      return new Response('RJFM Makati stream unavailable.', { status: 502 })
    }
    const headers = new Headers({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Type': upstream.headers.get('content-type')?.split(';')[0] ?? 'audio/mpeg',
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': 'none',
    })
    for (const name of ['icy-br', 'icy-description', 'icy-genre', 'icy-name', 'icy-url']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new Response(upstream.body, { status: 200, headers })
  } catch (error) {
    console.error('[morefm] RJFM Makati proxy failed', error)
    return new Response('RJFM Makati stream unavailable.', { status: 502 })
  }
}
