import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUpstreamUrl() {
  const configured = process.env.RJFM_UPSTREAM_STREAM_URL
  if (!configured) return null

  try {
    const url = new URL(configured)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url
  } catch {
    return null
  }
}

async function proxyStream(request: NextRequest, method: 'GET' | 'HEAD') {
  const upstreamUrl = getUpstreamUrl()
  if (!upstreamUrl) {
    return NextResponse.json(
      {
        error: 'RJ FM continuous stream is not configured.',
        requiredEnvironmentVariable: 'RJFM_UPSTREAM_STREAM_URL',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      cache: 'no-store',
      redirect: 'follow',
      signal: request.signal,
      headers: { Accept: 'audio/*, application/ogg, application/octet-stream' },
    })

    if (!upstream.ok || (method === 'GET' && !upstream.body)) {
      await upstream.body?.cancel().catch(() => undefined)
      return NextResponse.json(
        { error: 'The configured RJ FM upstream stream is unavailable.' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const contentType = upstream.headers.get('content-type') ?? 'audio/mpeg'
    const normalizedType = contentType.toLowerCase()
    if (
      !normalizedType.startsWith('audio/')
      && !normalizedType.includes('application/ogg')
      && !normalizedType.includes('application/octet-stream')
    ) {
      await upstream.body?.cancel().catch(() => undefined)
      return NextResponse.json(
        { error: 'The configured upstream did not return an audio stream.' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    })
    for (const name of ['icy-name', 'icy-description', 'icy-genre', 'icy-br', 'icy-metaint']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }

    return new Response(method === 'HEAD' ? null : upstream.body, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('[rjfm] stream proxy failed', error)
    return NextResponse.json(
      { error: 'Could not connect to the configured RJ FM upstream stream.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

export async function GET(request: NextRequest) {
  return proxyStream(request, 'GET')
}

export async function HEAD(request: NextRequest) {
  return proxyStream(request, 'HEAD')
}
