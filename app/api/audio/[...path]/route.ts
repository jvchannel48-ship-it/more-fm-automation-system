import { NextResponse } from 'next/server'
import { getSettings } from '@/lib/storage'
import { fetchSupabaseAudio } from '@/lib/supabase-media'
export const runtime = 'nodejs'
const AUDIO_PATH_PATTERN = /^[a-zA-Z0-9._-]+$/

// Only audio paths listed in the persisted station settings can be streamed.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  if (
    path.length !== 3
    || path[0] !== 'station'
    || path[1] !== 'audio'
    || path.some((segment) => !AUDIO_PATH_PATTERN.test(segment))
  ) {
    return NextResponse.json({ error: 'Audio not found.' }, { status: 404 })
  }

  try {
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

    const audio = await fetchSupabaseAudio(pathname)
    if (audio.status === 404) return NextResponse.json({ error: 'Audio not found.' }, { status: 404 })
    if (!audio.ok || !audio.body) {
      console.error(`[morefm] Supabase audio fetch failed (${audio.status}).`)
      return NextResponse.json({ error: 'Audio could not be loaded.' }, { status: 502 })
    }

    const headers = new Headers({
      'Content-Type': audio.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    })
    const contentLength = audio.headers.get('content-length')
    const etag = audio.headers.get('etag')
    if (contentLength) headers.set('Content-Length', contentLength)
    if (etag) headers.set('ETag', etag)
    return new Response(audio.body, { headers })
  } catch (error) {
    console.error('[morefm] private Supabase audio playback failed', error)
    return NextResponse.json({ error: 'Audio could not be loaded.' }, { status: 502 })
  }
}
