'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Download, Loader2, Moon, Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useBroadcast } from '@/hooks/use-broadcast'
import type { NowResponse } from '@/lib/types'
import { STATIONS, type StationId } from '@/lib/stations'
import { Equalizer } from './equalizer'
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
  const [externalStation, setExternalStation] = useState<{ name: string; url_resolved: string } | null>(null)
  const [externalPlaying, setExternalPlaying] = useState(false)
  const [stationVideoPlaying, setStationVideoPlaying] = useState(false)
  const externalAudioRef = useRef<HTMLAudioElement>(null)
  const stationVideoRef = useRef<HTMLVideoElement>(null)
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

  useEffect(() => {
    const playExternal = (event: Event) => {
      const picked = (event as CustomEvent<{ name: string; url_resolved: string }>).detail
      if (!picked?.url_resolved) return
      setPlaying(false)
      setExternalStation(picked)
      const audio = externalAudioRef.current
      if (!audio) return
      audio.src = picked.url_resolved
      audio.play().then(() => setExternalPlaying(true)).catch(() => setExternalPlaying(false))
    }
    window.addEventListener('morefm:play-external-station', playExternal)
    return () => window.removeEventListener('morefm:play-external-station', playExternal)
  }, [])

  const nowUrl = `/api/now?station=${station}`
  const { data, error, mutate } = useSWR(nowUrl, fetcher, {
    refreshInterval: playing ? 3000 : 30000,
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
        body: JSON.stringify({ id: getListenerId(), active, station }),
        cache: 'no-store',
      }).catch(() => undefined)
    }
    heartbeat(true)
    const interval = window.setInterval(() => heartbeat(true), 30_000)
    return () => { window.clearInterval(interval); heartbeat(false) }
  }, [playing, data?.offAir])

  const offAir = data?.offAir ?? false
  const live = externalPlaying || (playing && !buffering && !offAir)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cancelled = false
    void import('@/lib/app-permissions').then(({ syncBackgroundAudioNotification }) => {
      if (!cancelled) return syncBackgroundAudioNotification(live, externalStation?.name ?? `${meta.name} ${meta.frequency}`)
    }).catch((error) => console.warn('[RJ FM] Background audio notification could not sync', error))
    return () => { cancelled = true }
  }, [live, externalStation, station])

  const toggleStationVideo = () => {
    const video = stationVideoRef.current
    if (!video) return
    if (video.paused) {
      // Start the visual video muted and the RJ FM broadcast audio from the same user tap.
      video.muted = true
      video.currentTime = 0
      void video.play().then(() => {
        setStationVideoPlaying(true)
        unlock()
        setPlaying(true)
      }).catch(() => setStationVideoPlaying(false))
    } else {
      video.pause()
      setStationVideoPlaying(false)
      setPlaying(false)
    }
  }
  const onAirAgain = data?.nextOnAir
    ? new Date(data.nextOnAir).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
    : null
  const meta = STATIONS[station]

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = live ? 'playing' : 'paused'
    const playFromMedia = () => {
      if (externalStation && externalAudioRef.current) {
        void externalAudioRef.current.play().then(() => setExternalPlaying(true)).catch(() => undefined)
      } else { unlock(); setPlaying(true) }
    }
    const pauseFromMedia = () => {
      if (externalStation && externalAudioRef.current) {
        externalAudioRef.current.pause()
        setExternalPlaying(false)
      } else setPlaying(false)
    }
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
  }, [playing, offAir, unlock, live, externalStation])

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
    <section aria-label={`${meta.name} ${meta.frequency} live player`} className={`radio-player radio-player-card flex w-full flex-col items-center text-center bg-[#09090b] text-white ${playerPreferences.compact ? 'gap-3' : 'gap-4'} ${playerPreferences.showBorder ? 'border border-primary/20' : 'border-0'}`}>
      {!Capacitor.isNativePlatform() && <a href="https://github.com/jvchannel48-ship-it/more-fm-automation-system/releases/download/android-latest/rj-fm-android.apk" className="mb-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/40 bg-gradient-to-b from-cyan-300 to-blue-500 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-[0_7px_0_#123a70,0_12px_25px_rgba(14,165,233,.28)] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_3px_0_#123a70,0_5px_12px_rgba(14,165,233,.25)]" download>
        <Download className="size-4" /> Download RJ FM APK
      </a>}
      <span className={`live-badge inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] ${offAir ? 'border-border text-muted-foreground' : 'border-live/40 bg-live/10 text-live'}`}>
        <span className={`size-1.5 rounded-full ${offAir ? 'bg-muted-foreground' : 'animate-pulse bg-live'}`} aria-hidden="true" />
        {externalStation ? (externalPlaying ? 'Live · External station' : 'External station paused') : (offAir ? 'Off air' : 'Live')}
      </span>
      {data?.liveDj?.active && (
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-200">
          <span className="size-1.5 animate-pulse rounded-full bg-rose-400" aria-hidden="true" />
          Live DJ · {data.liveDj.name || 'On air'}
        </span>
      )}

      <div className="w-full max-w-2xl overflow-hidden rounded-[1.6rem] border border-white/20 bg-black shadow-[0_22px_55px_rgba(0,0,0,.62)]">
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          <video
            ref={stationVideoRef}
            className="absolute inset-0 block h-full w-full object-cover"
            src="/audio/raphael-video-c3d072c0-ee50-469c-a19c-0378ca47dc7e.mp4"
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={`${meta.name} video player`}
            onPlay={() => setStationVideoPlaying(true)}
            onPause={() => setStationVideoPlaying(false)}
          />
          {!stationVideoPlaying && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15" aria-hidden="true" />
          )}
          <Button
            type="button"
            size="icon"
            onClick={toggleStationVideo}
            aria-label={stationVideoPlaying ? `Pause ${meta.name}` : `Play ${meta.name}`}
            className="absolute left-1/2 top-1/2 z-10 size-[4.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 bg-black/55 text-white shadow-[0_0_0_8px_rgba(255,255,255,.12),0_10px_28px_rgba(0,0,0,.55)] backdrop-blur-md hover:bg-black/75 [&_svg]:size-8"
          >
            {stationVideoPlaying ? <Pause /> : <Play className="translate-x-0.5" />}
          </Button>
        </div>
        <div className="flex items-center justify-center gap-2 border-t border-white/10 bg-gradient-to-r from-[#26090c] via-[#7f1019] to-[#26090c] px-4 py-3 text-sm font-black tracking-[0.28em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)]">
          <span className="size-2 animate-pulse rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,.9)]" aria-hidden="true" /> LIVE
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="player-title font-mono text-lg font-semibold tracking-wide">
          {externalStation ? externalStation.name : <>{meta.shortName} <span className="text-primary">{meta.frequency}</span></>}
        </p>
        <div className="mt-2"><div className="signal-bars"><Equalizer active={live} /></div></div>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">{externalStation ? 'Philippine Radio Browser stream' : (data?.liveDj?.active ? 'Live DJ on air' : meta.notificationTagline)}</p>
        {buffering && playing && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Buffering…</p>}
        {error && !data && <p className="text-sm text-destructive" role="alert">Could not connect to the station. Retrying…</p>}
        {(playbackIssue || recoveryIssue) && <p className="text-xs text-amber-200/90">{recoveryIssue || playbackIssue}</p>}
        {offAir && !externalStation && (
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

      <audio ref={externalAudioRef} className="hidden" preload="none" onPlay={() => setExternalPlaying(true)} onPause={() => setExternalPlaying(false)} onError={() => setExternalPlaying(false)} />
      {externalStation && <Button type="button" variant="outline" size="sm" onClick={() => { externalAudioRef.current?.pause(); setExternalStation(null); setExternalPlaying(false) }}>Return to RJ FM</Button>}
    </section>
  )
}
