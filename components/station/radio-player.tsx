'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Loader2, Moon, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useBroadcast } from '@/hooks/use-broadcast'
import type { NowResponse } from '@/lib/types'

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error('Station unavailable')
    return r.json() as Promise<NowResponse>
  })

function StationVerifiedBadge() {
  return (
    <svg
      aria-label="MOR 93.5 station badge"
      role="img"
      viewBox="0 0 24 24"
      className="inline-block size-6 shrink-0 align-middle drop-shadow-[0_2px_8px_rgba(24,119,242,0.35)]"
    >
      <circle cx="12" cy="12" r="10" fill="#1877F2" />
      <path d="m7.3 12.1 3.05 3.05 6.45-6.4" fill="none" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      <title>MOR 93.5 station badge</title>
    </svg>
  )
}

export function RadioPlayer() {
  const [playing, setPlaying] = useState(false)
  const [checkingCapacity, setCheckingCapacity] = useState(false)
  const [listenerMessage, setListenerMessage] = useState('')
  const [nowPlayingIssue, setNowPlayingIssue] = useState('')
  const [volume, setVolume] = useState(0.9)
  const [muted, setMuted] = useState(false)
  const { data, error, mutate } = useSWR('/api/now', fetcher, {
    refreshInterval: playing ? 8000 : 30000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  })
  const { buffering, playbackIssue, unlock, offAir: scheduledOffAir } = useBroadcast(data, playing, muted ? 0 : volume)
  useEffect(() => {
    if (!playbackIssue) return
    setPlaying(false)
    void mutate()
  }, [playbackIssue, mutate])
  useEffect(() => {
    if (!playing || data) {
      setNowPlayingIssue('')
      return
    }
    const timeout = window.setTimeout(() => setNowPlayingIssue('The station has not returned a playback response. Press Play again to reconnect.'), 25_000)
    return () => window.clearTimeout(timeout)
  }, [playing, data])
  useEffect(() => {
    if (!nowPlayingIssue) return
    setPlaying(false)
    void mutate()
  }, [nowPlayingIssue, mutate])
  useEffect(() => {
    if (!playing || data?.offAir) return
    let id = localStorage.getItem('morefm-listener-id')
    if (!id) {
      id = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `listener-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('morefm-listener-id', id)
    }
    const send = async (active: boolean) => {
      try {
        const response = await fetch('/api/listeners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active }),
        keepalive: !active,
        })
        const result = await response.json().catch(() => null) as { accepted?: boolean; message?: string } | null
        if (active && (!response.ok || result?.accepted === false)) {
          setListenerMessage(result?.message ?? 'Could not check listener capacity. Please try again.')
          setPlaying(false)
        }
      } catch {
        if (active) {
          setListenerMessage('Could not check listener capacity. Please try again.')
          setPlaying(false)
        }
      }
    }
    void send(true)
    const interval = window.setInterval(() => send(true), 20_000)
    return () => {
      window.clearInterval(interval)
      send(false)
    }
  }, [playing, data?.offAir])

  const offAir = (data?.offAir ?? false) || scheduledOffAir
  const live = playing && !buffering && !offAir && !playbackIssue
  const listenerId = () => {
    let id = localStorage.getItem('morefm-listener-id')
    if (!id) {
      id = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `listener-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('morefm-listener-id', id)
    }
    return id
  }

  const togglePlay = async () => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (checkingCapacity) return
    unlock()
    setCheckingCapacity(true)
    setListenerMessage('')
    setNowPlayingIssue('')
    try {
      const response = await fetch('/api/listeners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: listenerId(), active: true }),
      })
      const result = await response.json().catch(() => null) as { accepted?: boolean; message?: string } | null
      if (!response.ok || result?.accepted !== true) {
        setListenerMessage(result?.message ?? 'Could not check listener capacity. Please try again.')
        return
      }
      setPlaying(true)
    } catch {
      setListenerMessage('Could not check listener capacity. Please try again.')
    } finally {
      setCheckingCapacity(false)
    }
  }

  const onAirAgain = data?.nextOnAir
    ? new Date(data.nextOnAir).toLocaleTimeString('en-PH', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Manila',
      })
    : null

  return (
    <section aria-label="MOR 93.5 Naga live player" className="studio-deck flex w-full flex-col items-center gap-8 px-4 py-8 text-center">
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] ${
          offAir ? 'border-border text-muted-foreground' : 'border-live/40 bg-live/10 text-live'
        }`}
      >
        <span
          className={`size-1.5 rounded-full ${offAir ? 'bg-muted-foreground' : 'animate-pulse bg-live'}`}
          aria-hidden="true"
        />
        {offAir ? 'Off Air' : 'Live'}
      </span>

      <div className="relative flex size-64 items-center justify-center sm:size-72">
        <div
          className="absolute inset-0 rounded-full border border-primary/25"
          style={{ animation: live ? 'ring-pulse 2.4s ease-out infinite' : 'none' }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-3 rounded-full bg-[repeating-radial-gradient(circle,var(--secondary)_0_2px,var(--card)_2px_5px)] shadow-2xl shadow-black/50"
          style={{ animation: live ? 'spin 6s linear infinite' : 'none' }}
          aria-hidden="true"
        />
        <div className="absolute inset-[28%] rounded-full bg-gradient-to-br from-primary to-primary/70" aria-hidden="true" />

        <Button
          size="icon"
          onClick={() => void togglePlay()}
          disabled={offAir || checkingCapacity}
          aria-label={playing ? 'Pause MOR 93.5 Naga' : 'Play MOR 93.5 Naga'}
          className="relative size-20 rounded-full bg-background text-primary shadow-xl hover:bg-background/90 [&_svg]:size-8"
        >
          {offAir ? (
            <Moon aria-hidden="true" />
          ) : checkingCapacity ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : playing && buffering ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : playing ? (
            <Pause aria-hidden="true" />
          ) : (
            <Play className="translate-x-0.5" aria-hidden="true" />
          )}
        </Button>
      </div>

      <div className="flex flex-col items-center gap-2" aria-live="polite">
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          MOR <span className="text-primary">93.5</span> Naga <StationVerifiedBadge />
        </h2>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          MOR 93.5 NAGA LIVESTREAM ONLY
        </p>
        {offAir && (
          <p className="text-sm text-muted-foreground">
            {onAirAgain ? `Signed off. We will be back at ${onAirAgain}.` : 'Signed off.'}
          </p>
        )}
        {error && !data && (
          <p className="text-sm text-destructive" role="alert">
            Could not connect to the station. Retrying...
          </p>
        )}
        {playbackIssue && <p className="max-w-sm text-sm font-semibold text-amber-300" role="alert" aria-live="assertive">{playbackIssue}</p>}
        {nowPlayingIssue && <p className="max-w-sm text-sm font-semibold text-amber-300" role="alert" aria-live="assertive">{nowPlayingIssue}</p>}
        {listenerMessage && <p className="max-w-sm text-sm font-semibold text-destructive" role="alert" aria-live="assertive">{listenerMessage}</p>}
      </div>

      <div className="flex w-full max-w-xs items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="shrink-0 text-muted-foreground"
        >
          {muted || volume === 0 ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </Button>
        <Slider
          value={[muted ? 0 : volume * 100]}
          onValueChange={(v) => {
            const next = Array.isArray(v) ? v[0] : v
            setVolume(next / 100)
            setMuted(false)
          }}
          max={100}
          step={1}
          aria-label="Volume"
        />
      </div>
    </section>
  )
}
