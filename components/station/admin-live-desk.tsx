'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clapperboard, Mic, MicOff, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type LiveState = { active: boolean; name: string; updatedAt: number }

const SOUNDBOARD: Array<{ id: string; label: string; kind: 'applause' | 'cheer' | 'airhorn' | 'whoosh' | 'beep' | 'sting' | 'laugh' | 'boom' | 'chime' | 'radio' }> = [
  { id: 'applause', label: 'Applause', kind: 'applause' },
  { id: 'cheer', label: 'Cheer', kind: 'cheer' },
  { id: 'airhorn', label: 'Airhorn', kind: 'airhorn' },
  { id: 'whoosh', label: 'Whoosh', kind: 'whoosh' },
  { id: 'beep', label: 'Beep', kind: 'beep' },
  { id: 'sting', label: 'Sting', kind: 'sting' },
  { id: 'laugh', label: 'Laugh', kind: 'laugh' },
  { id: 'boom', label: 'Boom', kind: 'boom' },
  { id: 'chime', label: 'Chime', kind: 'chime' },
  { id: 'radio', label: 'Radio ID', kind: 'radio' },
]

function playSfx(kind: (typeof SOUNDBOARD)[number]['kind']) {
  const ctx = new AudioContext()
  const now = ctx.currentTime
  const master = ctx.createGain()
  master.gain.value = 0.35
  master.connect(ctx.destination)

  const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.3) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, now + start)
    g.gain.setValueAtTime(0.0001, now + start)
    g.gain.exponentialRampToValueAtTime(gain, now + start + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
    o.connect(g).connect(master)
    o.start(now + start)
    o.stop(now + start + dur + 0.05)
  }

  const noiseBurst = (start: number, dur: number, gain = 0.2) => {
    const frames = Math.floor(ctx.sampleRate * dur)
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
    const src = ctx.createBufferSource()
    const g = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1800
    src.buffer = buffer
    g.gain.value = gain
    src.connect(filter).connect(g).connect(master)
    src.start(now + start)
  }

  switch (kind) {
    case 'applause':
      for (let i = 0; i < 8; i++) noiseBurst(i * 0.08, 0.35, 0.12)
      break
    case 'cheer':
      noiseBurst(0, 0.5, 0.18)
      tone(520, 0, 0.25, 'triangle', 0.15)
      tone(780, 0.05, 0.3, 'triangle', 0.12)
      break
    case 'airhorn':
      tone(370, 0, 0.9, 'sawtooth', 0.22)
      tone(392, 0.05, 0.85, 'sawtooth', 0.18)
      break
    case 'whoosh':
      noiseBurst(0, 0.6, 0.22)
      break
    case 'beep':
      tone(880, 0, 0.12, 'square', 0.2)
      break
    case 'sting':
      tone(220, 0, 0.15, 'sawtooth', 0.2)
      tone(330, 0.12, 0.18, 'sawtooth', 0.18)
      tone(440, 0.25, 0.35, 'sawtooth', 0.16)
      break
    case 'laugh':
      for (let i = 0; i < 5; i++) tone(300 + i * 40, i * 0.09, 0.08, 'triangle', 0.14)
      break
    case 'boom':
      tone(55, 0, 0.5, 'sine', 0.4)
      noiseBurst(0, 0.25, 0.25)
      break
    case 'chime':
      tone(523, 0, 0.6, 'sine', 0.18)
      tone(659, 0.05, 0.6, 'sine', 0.14)
      tone(784, 0.1, 0.7, 'sine', 0.12)
      break
    case 'radio':
      tone(1000, 0, 0.08, 'square', 0.15)
      tone(1400, 0.1, 0.08, 'square', 0.12)
      tone(1000, 0.2, 0.12, 'square', 0.15)
      break
  }
  window.setTimeout(() => void ctx.close(), 2000)
}

async function requestMicStream(): Promise<MediaStream> {
  if (typeof window === 'undefined') throw new Error('Microphone is only available in the browser.')
  if (!window.isSecureContext) {
    throw new Error('Microphone needs HTTPS. Open the site with https:// then try Mic ON again.')
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support the microphone API.')
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      video: false,
    })
  } catch (first) {
    if (first instanceof DOMException && (first.name === 'NotAllowedError' || first.name === 'PermissionDeniedError')) {
      throw first
    }
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  }
}

function micErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Microphone permission denied. Allow mic for this site in browser settings, then tap Mic ON again.'
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No microphone found on this device.'
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'Microphone is busy (another app may be using it). Close other apps and try again.'
    }
    if (error.name === 'SecurityError') {
      return 'Browser blocked the mic (needs HTTPS). Open the secure site URL and try again.'
    }
    return error.message || 'Could not open the microphone.'
  }
  if (error instanceof Error) return error.message
  return 'Could not open the microphone.'
}

export function AdminLiveDesk() {
  const [live, setLive] = useState<LiveState>({ active: false, name: '', updatedAt: 0 })
  const [djName, setDjName] = useState('Live DJ')
  const [micBusy, setMicBusy] = useState(false)
  const [micError, setMicError] = useState('')
  const [status, setStatus] = useState('')
  const [level, setLevel] = useState(0)

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)

  const loadLive = useCallback(async () => {
    const res = await fetch('/api/admin/live', { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json() as LiveState
    setLive(data)
    if (data.name) setDjName(data.name)
  }, [])

  useEffect(() => {
    void loadLive()
  }, [loadLive])

  const stopMic = useCallback(async () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (audioCtxRef.current) {
      await audioCtxRef.current.close().catch(() => undefined)
      audioCtxRef.current = null
    }
    setLevel(0)
  }, [])

  const setLiveState = async (active: boolean) => {
    setMicBusy(true)
    setMicError('')
    setStatus('')
    try {
      if (active) {
        const stream = await requestMicStream()
        streamRef.current = stream

        const ctx = new AudioContext()
        audioCtxRef.current = ctx
        if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined)

        const source = ctx.createMediaStreamSource(stream)
        const highpass = ctx.createBiquadFilter()
        highpass.type = 'highpass'
        highpass.frequency.value = 90
        const compressor = ctx.createDynamicsCompressor()
        compressor.threshold.value = -26
        compressor.knee.value = 18
        compressor.ratio.value = 6
        compressor.attack.value = 0.003
        compressor.release.value = 0.18
        const monitor = ctx.createGain()
        monitor.gain.value = 0.22
        source.connect(highpass).connect(compressor).connect(monitor).connect(ctx.destination)

        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        compressor.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          if (!streamRef.current) return
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length)
          setLevel(Math.min(1, rms * 4))
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } else {
        await stopMic()
      }

      const res = await fetch('/api/admin/live', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active, name: djName.trim() || 'Live DJ' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        await stopMic()
        throw new Error(data.error === 'Unauthorized' ? 'Admin session expired. Log in again.' : (data.error || 'Could not update live mic status'))
      }
      setLive(data)
      setStatus(active
        ? 'Mic ON — music soft-ducks for listeners. Use headphones to avoid feedback.'
        : 'Mic OFF')
    } catch (error) {
      await stopMic()
      setMicError(micErrorMessage(error))
      setLive((current) => ({ ...current, active: false }))
      void fetch('/api/admin/live', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false, name: djName.trim() || 'Live DJ' }),
      }).catch(() => undefined)
    } finally {
      setMicBusy(false)
    }
  }

  useEffect(() => () => { void stopMic() }, [stopMic])

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-rose-400/30 bg-gradient-to-br from-rose-500/10 via-card to-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
            {live.active ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">Live mic</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Echo-cancelled mic. When ON, background music soft-ducks. Allow microphone when the browser asks.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <Label htmlFor="dj-name">On-air name</Label>
            <Input
              id="dj-name"
              className="mt-1"
              value={djName}
              maxLength={40}
              onChange={(event) => setDjName(event.target.value)}
              placeholder="DJ name"
              disabled={micBusy || live.active}
            />
          </div>
          {live.active && (
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-rose-400 transition-[width] duration-75"
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={live.active ? 'destructive' : 'default'}
              disabled={micBusy}
              onClick={() => void setLiveState(!live.active)}
            >
              {live.active ? <MicOff /> : <Mic />}
              {micBusy ? 'Updating…' : live.active ? 'Mic OFF' : 'Mic ON'}
            </Button>
          </div>
          {status && <p className="text-xs text-emerald-300">{status}</p>}
          {micError && (
            <p className="text-xs text-destructive" role="alert">
              {micError}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200">
            <Clapperboard className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold">Soundboard</h3>
            <p className="mt-1 text-xs text-muted-foreground">10 SFX. Use headphones to avoid feedback.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SOUNDBOARD.map((fx) => (
            <Button key={fx.id} type="button" variant="secondary" className="h-11 text-xs" onClick={() => playSfx(fx.kind)}>
              <Volume2 className="size-3.5" /> {fx.label}
            </Button>
          ))}
        </div>
      </section>
    </div>
  )
}
