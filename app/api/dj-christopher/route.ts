import { NextRequest, NextResponse } from 'next/server'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EdgeTTS } from 'node-edge-tts'
import { getChristopherScript } from '@/lib/dj-christopher'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const audioCache = new Map<string, Buffer>()

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid DJ script.' }, { status: 400 })
  const cached = audioCache.get(id)
  if (cached) return new Response(new Uint8Array(cached), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' } })

  const text = await getChristopherScript(id)
  if (!text) return NextResponse.json({ error: 'DJ script not found.' }, { status: 404 })
  const folder = await mkdtemp(join(tmpdir(), 'rjfm-christopher-'))
  const filepath = join(folder, 'christopher.mp3')
  try {
    const tts = new EdgeTTS({
      voice: 'en-US-ChristopherNeural',
      lang: 'en-US',
      outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
      rate: '+12%',
      volume: '+20%',
      timeout: 30000,
    })
    await tts.ttsPromise(text, filepath)
    const audio = await readFile(filepath)
    if (audio.length < 1024) throw new Error('Edge TTS returned an empty audio file.')
    audioCache.set(id, audio)
    if (audioCache.size > 50) audioCache.delete(audioCache.keys().next().value!)
    return new Response(new Uint8Array(audio), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' } })
  } catch (error) {
    console.error('[RJ FM] DJ Christopher Edge TTS failed', error)
    return NextResponse.json({ error: 'DJ Christopher voice is temporarily unavailable.' }, { status: 503 })
  } finally {
    await rm(folder, { recursive: true, force: true }).catch(() => undefined)
  }
}
