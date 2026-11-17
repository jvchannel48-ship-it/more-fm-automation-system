import { type NextRequest, NextResponse } from 'next/server'
import { synthesizeEdgeTts } from '@/lib/edge-tts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get('text')?.trim() ?? ''
  if (!text || text.length > 1800) {
    return NextResponse.json({ error: 'Speech text is missing or too long.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const audio = await synthesizeEdgeTts(text)
    return new Response(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.byteLength),
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[morefm] edge tts failed', error)
    return NextResponse.json({ error: 'Edge TTS is temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
