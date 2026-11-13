import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { getSettings } from '@/lib/storage'

export const runtime = 'nodejs'

const AUDIO_PATH_PATTERN = /^[a-zA-Z0-9._-]+$/

// Radio audio is intentionally playable by listeners, but its Blob remains in
// the private store; this route exposes only audio paths currently in settings.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  if (
    path.length !== 3 ||
    path[0] !== 'station' ||
    path[1] !== 'audio' ||
    path.some((segment) => !AUDIO_PATH_PATTERN.test(segment))
  ) {
    return NextResponse.json({ error: 'Audio not found.' }, { status: 404 })
  }

  const pathname = path.join('/')
  const settings = await getSettings()
  const configuredAssets = [
    settings.jingle,
    ...settings.commercials,
    settings.goldenSunday,
    settings.news,
    settings.djMic,
  ]
  if (!configuredAssets.some((asset) => asset?.pathname === pathname)) {
    return NextResponse.json({ error: 'Audio not found.' }, { status: 404 })
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN ?? process.env.VERCEL_BLOB_READ_WRITE_TOKEN
  if (!blobToken && !process.env.VERCEL_OIDC_TOKEN) {
    return NextResponse.json({ error: 'Audio storage is not configured.' }, { status: 503 })
  }

  try {
    const blob = await get(pathname, {
      access: 'private',
      ...(blobToken ? { token: blobToken } : {}),
    })
    if (!blob?.stream) return NextResponse.json({ error: 'Audio not found.' }, { status: 404 })

    return new Response(blob.stream, {
      headers: {
        'Content-Type': blob.blob.contentType || 'application/octet-stream',
        'Content-Length': String(blob.blob.size),
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        ETag: blob.blob.etag,
      },
    })
  } catch (error) {
    console.error('[morefm] private audio playback failed', error)
    return NextResponse.json({ error: 'Audio could not be loaded.' }, { status: 502 })
  }
}
