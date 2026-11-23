import { type NextRequest, NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'
import ffmpegPath from 'ffmpeg-static'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const noStore = { 'Cache-Control': 'private, no-store, no-transform' }

/** Only allow the known music CDN hosts used by RJ FM. */
function isAllowedMediaUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    const host = url.hostname.toLowerCase()
    if (host === 'us1.amfmph.com' && url.port === '8852' && url.pathname === '/live') return true
    if (url.port) return false
    return /^cdn\\d+\\.savetube\\.vip$/i.test(host)
      || /(^|\\.)savetube\\.(vip|me|io|com)$/i.test(host)
      || /(^|\\.)save\\.tube$/i.test(host)
      || /(^|\\.)rapidcdn\\./i.test(host)
      || /(^|\\.)ytmp3\\./i.test(host)
      || /(^|\\.)y2mate\\./i.test(host)
      || host.endsWith('googlevideo.com')
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('src')
  if (!source || source.length > 4096 || !isAllowedMediaUrl(source)) {
    return NextResponse.json({ error: 'Invalid audio source.' }, { status: 400, headers: noStore })
  }
  if (!ffmpegPath) {
    return NextResponse.json({ error: 'AAC encoder is unavailable on this server.' }, { status: 503, headers: noStore })
  }

  let upstream: Response
  try {
    upstream = await fetch(source, {
      headers: {
        Accept: 'audio/*;q=0.9,*/*;q=0.5',
        Referer: 'https://www.youtube.com/',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
      },
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(55_000),
    })
  } catch {
    return NextResponse.json({ error: 'Audio source is unavailable.' }, { status: 502, headers: noStore })
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Audio source is unavailable.' }, { status: 502, headers: noStore })
  }
  const contentType = (upstream.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('text/html') || contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Audio source is not a playable audio file.' }, { status: 502, headers: noStore })
  }

  const encoder = spawn(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error',
    '-i', 'pipe:0',
    '-vn', '-ac', '1', '-ar', '24000',
    '-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '32k',
    '-f', 'adts', 'pipe:1',
  ], { stdio: ['pipe', 'pipe', 'ignore'] })

  const sourceStream = Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream)
  sourceStream.on('error', () => encoder.kill('SIGTERM'))
  sourceStream.pipe(encoder.stdin)
  request.signal.addEventListener('abort', () => {
    sourceStream.destroy()
    encoder.kill('SIGTERM')
  }, { once: true })

  encoder.on('error', () => {
    sourceStream.destroy()
  })

  const output = Readable.toWeb(encoder.stdout) as ReadableStream<Uint8Array>
  return new Response(output, {
    headers: {
      ...noStore,
      'Content-Type': 'audio/aac',
      'X-Audio-Codec': 'AAC-LC',
      'X-Audio-Bitrate': '32kbps',
      'X-Audio-Channels': '1',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'none',
    },
  })
}
