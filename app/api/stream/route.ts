import { getNowPlaying } from '@/lib/station'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function GET(request: Request) {
  let cancelled = false
  request.signal.addEventListener('abort', () => {
    cancelled = true
  })

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (!cancelled && !request.signal.aborted) {
          const now = await getNowPlaying()
          if (now.offAir || now.tracks.length === 0) {
            await sleep(1000)
            continue
          }

          // TTS announcements are optional. If the TTS provider is unavailable,
          // never let a failed DJ-mic track block the actual MOR/DZMM audio.
          const audioTracks = now.tracks.filter((item) => item.kind !== 'dj-mic')
          if (audioTracks.length === 0) {
            await sleep(500)
            continue
          }
          const track = audioTracks.find((item) => item.startAt + item.duration * 1000 > Date.now()) ?? audioTracks[0]
          const sourceUrl = new URL(track.src, request.url).toString()
          const upstream = await fetch(sourceUrl, {
            cache: 'no-store',
            signal: request.signal,
          })
          if (!upstream.ok || !upstream.body) {
            await sleep(500)
            continue
          }

          const reader = upstream.body.getReader()
          const contentLength = Number(upstream.headers.get('content-length') ?? 0)
          const bytesPerSecond = contentLength > 0 && track.duration > 0 ? contentLength / track.duration : 16_000

          while (!cancelled && !request.signal.aborted) {
            const { done, value } = await reader.read()
            if (done) break
            if (!value?.length) continue
            controller.enqueue(value)
            // Pace the upstream bytes so the response behaves like a continuous live stream.
            await sleep(Math.max(8, Math.round((value.length / bytesPerSecond) * 1000)))
          }
          reader.releaseLock()
        }
      } catch (error) {
        if (!cancelled && !request.signal.aborted) controller.error(error)
      } finally {
        if (!cancelled && !request.signal.aborted) controller.close()
      }
    },
    cancel() {
      cancelled = true
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      'Accept-Ranges': 'none',
      'X-Content-Type-Options': 'nosniff',
      Connection: 'keep-alive',
    },
  })
}
