'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Loader2, Moon, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useBroadcast } from '@/hooks/use-broadcast'
import type { NowResponse } from '@/lib/types'
import { Equalizer } from './equalizer'
import { SongRequest } from './song-request'

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error('Station unavailable')
    return r.json() as Promise<NowResponse>
  })

function getManilaHour() {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }).format(new Date()))
}

export function RadioPlayer() {
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [muted, setMuted] = useState(false)
  const [manilaHour, setManilaHour] = useState(getManilaHour)
  const [recoveryIssue, setRecoveryIssue] = useState<string | null>(null)
  const listenerId = useRef<string | null>(null)
  const { data, error, mutate } = useSWR('/api/now', fetcher, {
    refreshInterval: playing ? 8000 : 30000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  })
  const recoverStream = useCallback((uid: string) => {
    setRecoveryIssue('May aberya sa audio; sinusubukan ang susunod na source...')
    void fetch('/api/now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not recover the station queue')
        return response.json() as Promise<NowResponse>
      })
      .then((updated) => {
        setRecoveryIssue(null)
        void mutate(updated, { revalidate: false })
      })
      .catch(() => {
        setRecoveryIssue('Hindi ma-recover ang source sa ngayon. Sinusubukan ulit ang station...')
        void mutate()
      })
  }, [mutate])
  const nightVolume = manilaHour >= 20 || manilaHour < 4 ? 0.7 : volume
  const { buffering, playbackIssue, unlock } = useBroadcast(data, playing, muted ? 0 : nightVolume, recoverStream)

  useEffect(() => {
    const interval = window.setInterval(() => setManilaHour(getManilaHour()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!playing || data?.offAir) return
    const getListenerId = () => {
      if (listenerId.current) return listenerId.current
      const storageKey = 'mor-935-listener-id'
      let id: string | null = null
      try {
        id = window.localStorage.getItem(storageKey)
      } catch {
        // Continue with a session-only ID if local storage is unavailable.
      }
      if (!id) {
        id = `listener-${window.crypto.randomUUID()}`
        try {
          window.localStorage.setItem(storageKey, id)
        } catch {
          // The ref keeps this ID stable until the player unmounts.
        }
      }
      listenerId.current = id
      return id
    }
    const heartbeat = (active: boolean) => {
      void fetch('/api/listeners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: getListenerId(), active }),
        cache: 'no-store',
      }).catch(() => undefined)
    }
    heartbeat(true)
    const interval = window.setInterval(() => heartbeat(true), 30_000)
    return () => {
      window.clearInterval(interval)
      heartbeat(false)
    }
  }, [playing, data?.offAir])

  const offAir = data?.offAir ?? false
  const live = playing && !buffering && !offAir
  const togglePlay = () => {
    unlock()
    setPlaying((p) => !p)
  }

  const onAirAgain = data?.nextOnAir
    ? new Date(data.nextOnAir).toLocaleTimeString('en-PH', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Manila',
      })
    : null

  return (
    <section aria-label="MOR 93.5 live player" className="radio-player flex w-full flex-col items-center gap-8 text-center">
      <span
        className={`live-badge inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] ${
          offAir ? 'border-border text-muted-foreground' : 'border-live/40 bg-live/10 text-live'
        }`}
      >
        <span
          className={`size-1.5 rounded-full ${offAir ? 'bg-muted-foreground' : 'animate-pulse bg-live'}`}
          aria-hidden="true"
        />
        {offAir ? 'Off Air' : 'Live'}
      </span>

      <div className="vinyl-stage relative flex size-64 items-center justify-center sm:size-72">
        <div
          className="absolute inset-0 rounded-full border border-primary/25"
          style={{ animation: live ? 'ring-pulse 2.4s ease-out infinite' : 'none' }}
          aria-hidden="true"
        />
        <div
          className="vinyl-record absolute inset-3 rounded-full"
          style={{ animation: live ? 'spin 6s linear infinite' : 'none' }}
          aria-hidden="true"
        />
        <div className="vinyl-label absolute inset-[28%] rounded-full" aria-hidden="true">
          <span className="vinyl-label-mark">MOR</span>
        </div>
        <div className="vinyl-hole absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full" aria-hidden="true" />

        <Button
          size="icon"
          onClick={togglePlay}
          disabled={offAir}
          aria-label={playing ? 'Pause MOR 93.5' : 'Play MOR 93.5'}
          className="record-button relative size-20 rounded-full bg-background text-primary shadow-xl hover:bg-background/90 [&_svg]:size-8"
        >
          {offAir ? (
            <Moon aria-hidden="true" />
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
        <h2 className="player-title text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          MOR <span className="text-primary">93.5</span>
        </h2>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          No. 1 Bicol Region · ABS-CBN Complex
        </p>
        <div className="mt-2">
          <div className="signal-bars">
            <Equalizer active={live} />
          </div>
        </div>
        {offAir && (
          <p className="text-sm text-muted-foreground">
            {onAirAgain ? `Signed off. Babalik kami ng ${onAirAgain}.` : 'Signed off.'}
          </p>
        )}
        {(recoveryIssue || playbackIssue) && (
          <p className="text-sm text-muted-foreground" role="status">
            {recoveryIssue ?? playbackIssue}
          </p>
        )}
        {error && !data && (
          <p className="text-sm text-destructive" role="alert">
            Hindi ma-connect sa station. Sinusubukan ulit...
          </p>
        )}
      </div>

      <div className="volume-deck flex w-full max-w-xs items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="shrink-0 text-muted-foreground hover:text-primary"
        >
          {muted || volume === 0 ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </Button>
        <Slider
          value={[muted ? 0 : nightVolume * 100]}
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

      <SongRequest />
    </section>
  )
}
