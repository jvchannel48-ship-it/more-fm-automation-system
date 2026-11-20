'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clapperboard, Mic, MicOff, Radio, Search, Send, Trash2, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ListenerMessage } from '@/lib/types'

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

export function AdminLiveDesk() {
  const [live, setLive] = useState<LiveState>({ active: false, name: '', updatedAt: 0 })
  const [djName, setDjName] = useState('Live DJ')
  const [micBusy, setMicBusy] = useState(false)
  const [micError, setMicError] = useState('')
  const [searchTitle, setSearchTitle] = useState('')
  const [searchArtist, setSearchArtist] = useState('')
  const [playlistMsg, setPlaylistMsg] = useState('')
  const [messages, setMessages] = useState<ListenerMessage[]>([])
  const [status, setStatus] = useState('')

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const loadLive = useCallback(async () => {
    const res = await fetch('/api/admin/live', { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json() as LiveState
    setLive(data)
    if (data.name) setDjName(data.name)
  }, [])

  const loadMessages = useCallback(async () => {
    const res = await fetch('/api/messages', { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json() as { messages?: ListenerMessage[] }
    setMessages(Array.isArray(data.messages) ? data.messages : [])
  }, [])

  useEffect(() => {
    void loadLive()
    void loadMessages()
    const id = window.setInterval(() => { void loadMessages() }, 5000)
    return () => window.clearInterval(id)
  }, [loadLive, loadMessages])

  const stopMic = useCallback(async () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (audioCtxRef.current) {
      await audioCtxRef.current.close().catch(() => undefined)
      audioCtxRef.current = null
    }
  }, [])

  const setLiveState = async (active: boolean) => {
    setMicBusy(true)
    setMicError('')
    try {
      if (active) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        })
        streamRef.current = stream
        const ctx = new AudioContext()
        audioCtxRef.current = ctx
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
        monitor.gain.value = 0.35
        source.connect(highpass).connect(compressor).connect(monitor).connect(ctx.destination)
      } else {
        await stopMic()
      }

      const res = await fetch('/api/admin/live', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active, name: djName.trim() || 'Live DJ' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not update mic')
      setLive(data)
      setStatus(active ? 'Mic ON — music ducks for listeners. Use headphones to avoid feedback.' : 'Mic OFF')
    } catch (error) {
      await stopMic()
      setMicError(error instanceof Error ? error.message : 'Microphone unavailable')
      setLive((current) => ({ ...current, active: false }))
    } finally {
      setMicBusy(false)
    }
  }

  useEffect(() => () => { void stopMic() }, [stopMic])

  const queueSong = async () => {
    setPlaylistMsg('')
    const res = await fetch('/api/admin/playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: searchTitle, artist: searchArtist }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPlaylistMsg(data.error || 'Could not queue song')
      return
    }
    setPlaylistMsg(`Queued: ${searchTitle} — ${searchArtist}`)
    setSearchTitle('')
    setSearchArtist('')
  }

  const markRead = async (id: string) => {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-read', id }),
    })
    void loadMessages()
  }

  const clearMessages = async () => {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear' }),
    })
    setMessages([])
  }

  const unread = messages.filter((m) => !m.read).length

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
              Echo-cancelled mic. Background music soft-ducks while ON. Shown on player as Live DJ.
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
          {micError && <p className="text-xs text-destructive">{micError}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Search className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold">Playlist search</h3>
            <p className="mt-1 text-xs text-muted-foreground">Search a song and queue it to play next.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="pl-title">Title</Label>
            <Input id="pl-title" className="mt-1" value={searchTitle} onChange={(e) => setSearchTitle(e.target.value)} placeholder="Song title" />
          </div>
          <div>
            <Label htmlFor="pl-artist">Artist</Label>
            <Input id="pl-artist" className="mt-1" value={searchArtist} onChange={(e) => setSearchArtist(e.target.value)} placeholder="Artist" />
          </div>
        </div>
        <Button type="button" className="mt-3 w-full sm:w-auto" disabled={!searchTitle.trim() || !searchArtist.trim()} onClick={() => void queueSong()}>
          <Radio className="size-4" /> Queue to play
        </Button>
        {playlistMsg && <p className="mt-2 text-xs text-muted-foreground">{playlistMsg}</p>}
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

      <section className="rounded-2xl border border-sky-400/25 bg-sky-400/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-400/15 text-sky-200">
              <Send className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold">Listener messages {unread > 0 ? `(${unread} new)` : ''}</h3>
              <p className="mt-1 text-xs text-muted-foreground">From the player message button.</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => void clearMessages()}>
              <Trash2 className="size-3.5" /> Clear
            </Button>
          )}
        </div>
        <div className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto">
          {messages.length === 0 && <p className="text-xs text-muted-foreground">No messages yet.</p>}
          {messages.map((message) => (
            <button
              key={message.id}
              type="button"
              onClick={() => void markRead(message.id)}
              className={`rounded-xl border p-3 text-left transition ${message.read ? 'border-border/60 bg-background/30' : 'border-sky-400/40 bg-sky-400/10'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{message.fromName}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(message.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{message.body}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
