'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Loader2, Moon, Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useBroadcast } from '@/hooks/use-broadcast'
import type { NowResponse } from '@/lib/types'
import { STATIONS, type StationId } from '@/lib/stations'
import { Equalizer } from './equalizer'
import { SongRequest } from './song-request'
import { getStoredStation } from './station-selector'
import { DEFAULT_PLAYER_PREFERENCES, readPlayerPreferences, type PlayerPreferences } from '@/lib/player-preferences'

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error('Station unavailable')
    return r.json() as Promise<NowResponse>
  })

const vinylColors: Record<string, string> = { silver: '#cbd5e1', gold: '#f4b942', blue: '#60a5fa', red: '#fb7185', purple: '#c084fc', green: '#4ade80' }

export function RadioPlayer() {
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [recoveryIssue, setRecoveryIssue] = useState<string | null>(null)
  const [station, setStation] = useState<StationId>('main')
  const [playerPreferences, setPlayerPreferences] = useState<PlayerPreferences>(DEFAULT_PLAYER_PREFERENCES)
  const listenerId = useRef<string | null>(null)

  useEffect(() => {
    setStation(getStoredStation())
    setPlayerPreferences(readPlayerPreferences())
    const update = (event: Event) => setPlayerPreferences((event as CustomEvent<PlayerPreferences>).detail)
    window.addEventListener('morefm-player-preferences', update)
    return () => window.removeEventListener('morefm-player-preferences', update)
  }, [])

  const nowUrl = `/api/now?station=${station}`
  const { data, error, mutate } = useSWR(nowUrl, fetcher, {
    refreshInterval: playing ? 8000 : 30000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  })
  const recoverStream = useCallback((uid: string) => {
    setRecoveryIssue('Recovering audio source…')
    void fetch(`/api/now?station=${station}`, {
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
        setRecoveryIssue('Could not recover the source right now. Retrying…')
        void mutate()
      })
  }, [mutate, station])
  const { buffering, playbackIssue, unlock } = useBroadcast(data, playing, muted ? 0 : volume, recoverStream, station)

  useEffect(() => {
    if (!playing || data?.offAir) return
    const getListenerId = () => {
      if (listenerId.current) return listenerId.current
      const storageKey = 'mor-935-listener-id'
      let id: string | null = null
      try { id = window.localStorage.getItem(storageKey) } catch { /* session-only */ }
      if (!id) {
        id = `listener-${window.crypto.randomUUID()}`
        try { window.localStorage.setItem(storageKey, id) } catch { /* ok */ }
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
    return () => { window.clearInterval(interval); heartbeat(false) }
  }, [playing, data?.offAir])

  const offAir = data?.offAir ?? false
  const live = playing && !buffering && !offAir

  const togglePlay = () => { unlock(); setPlaying((p) => !p) }
  const onAirAgain = data?.nextOnAir
    ? new Date(data.nextOnAir).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
    : null
  const meta = STATIONS[station]

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = playing && !offAir ? 'playing' : 'paused'
    const playFromMedia = () => { unlock(); setPlaying(true) }
    const pauseFromMedia = () => setPlaying(false)
    try {
      navigator.mediaSession.setActionHandler('play', playFromMedia)
      navigator.mediaSession.setActionHandler('pause', pauseFromMedia)
      navigator.mediaSession.setActionHandler('stop', pauseFromMedia)
    } catch { /* Some WebViews expose only partial Media Session support. */ }
    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('stop', null)
      } catch { /* unsupported action */ }
    }
  }, [playing, offAir, unlock])

  useEffect(() => {
    document.title = `${meta.name} ${meta.frequency} — Live Radio`
    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${meta.name} ${meta.frequency}`,
        artist: meta.notificationTagline,
        album: 'RJ FM Live Radio',
        artwork: [{ src: '/rjfm-app-icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      })
    }
  }, [meta])

  return (
    <section aria-label={`${meta.name} ${meta.frequency} live player`} className={`radio-player radio-player-card flex w-full flex-col items-center text-center ${playerPreferences.compact ? 'gap-4' : 'gap-8'} ${playerPreferences.showBorder ? 'border border-primary/20' : 'border-0'} ${playerPreferences.background === 'ocean' ? 'bg-gradient-to-b from-blue-950/60 to-background' : playerPreferences.background === 'sunset' ? 'bg-gradient-to-b from-orange-950/50 to-background' : 'bg-background/20'}`}>
      <span className={`live-badge inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] ${offAir ? 'border-border text-muted-foreground' : 'border-live/40 bg-live/10 text-live'}`}>
        <span className={`size-1.5 rounded-full ${offAir ? 'bg-muted-foreground' : 'animate-pulse bg-live'}`} aria-hidden="true" />
        {offAir ? 'Off air' : 'Live'}
      </span>
      {data?.liveDj?.active && (
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-200">
          <span className="size-1.5 animate-pulse rounded-full bg-rose-400" aria-hidden="true" />
          Live DJ · {data.liveDj.name || 'On air'}
        </span>
      )}

      <div className="vinyl relative flex size-52 items-center justify-center rounded-full sm:size-60">
        <div className="vinyl-ring absolute inset-0 rounded-full" style={{ borderColor: vinylColors[playerPreferences.vinylColor] ?? vinylColors.gold }} aria-hidden="true" />
        <div className={`vinyl-record absolute inset-3 rounded-full border ${playing && !offAir ? 'animate-spin' : ''}`} style={{ animationDuration: '8s', borderColor: vinylColors[playerPreferences.vinylColor] ?? vinylColors.gold }} aria-hidden="true" />
        <div className="vinyl-label absolute inset-[28%] flex items-center justify-center rounded-full">
          <span className="vinyl-label-mark">{meta.vinylMark}</span>
        </div>
        <div className="vinyl-hole absolute size-3 rounded-full" aria-hidden="true" />
        <Button size="icon" onClick={togglePlay} aria-label={playing ? (offAir ? `Stop static for ${meta.name}` : `Pause ${meta.name}`) : (offAir ? `Hear off-air static for ${meta.name}` : `Play ${meta.name}`)} className="record-button relative size-20 rounded-full bg-background text-primary shadow-xl hover:bg-background/90 [&_svg]:size-8">
          {playing ? <Pause /> : <Play className="translate-x-0.5" />}
        </Button>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="player-title font-mono text-lg font-semibold tracking-wide">
          {meta.shortName} <span className="text-primary">{meta.frequency}</span>
        </p>
        <div className="mt-2"><div className="signal-bars"><Equalizer active={live} /></div></div>
        {buffering && playing && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Buffering…</p>}
        {error && !data && <p className="text-sm text-destructive" role="alert">Could not connect to the station. Retrying…</p>}
        {(playbackIssue || recoveryIssue) && <p className="text-xs text-amber-200/90">{recoveryIssue || playbackIssue}</p>}
        {offAir && (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Moon className="size-4" /> Off air{onAirAgain ? ` · back at ${onAirAgain}` : ''}
          </p>
        )}
      </div>

      {playerPreferences.showVolume && <div className="volume-deck flex w-full max-w-xs items-center gap-3">
        <Button type="button" variant="ghost" size="icon-sm" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
          {muted || volume === 0 ? <VolumeX /> : playerPreferences.volumeIcon === 'minimal' ? <Volume1 /> : <Volume2 />}
        </Button>
        <Slider value={[muted ? 0 : volume * 100]} onValueChange={(v) => { const next = typeof v === 'number' ? v : v[0]; setMuted(false); setVolume((next ?? 70) / 100) }} max={100} step={1} aria-label="Volume" />
      </div>}

      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-medium">
          {meta.name} <span className="text-primary">{meta.frequency}</span>
        </p>
      </div>

      {data?.songRequestsEnabled !== false && <SongRequest station={station} />}
    </section>
  )
}
