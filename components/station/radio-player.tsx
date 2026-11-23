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
  const [philippineTime, setPhilippineTime] = useState(() => new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }))
  const [philippineWeekday, setPhilippineWeekday] = useState(() => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short' }).format(new Date()))
  const isDearMorStation = station === 'cebu'
  const isDearMorDay = philippineWeekday !== 'Sun'
  const dearMorBlocktime = isDearMorStation && isDearMorDay && ((philippineTime >= '13:00' && philippineTime < '15:00') || (philippineTime >= '20:00' && philippineTime < '22:00'))
  const listenerId = useRef<string | null>(null)
  const unlockAction = useRef<() => void>(() => undefined)

  useEffect(() => {
    const updatePhilippineTime = () => {
      const now = new Date()
      setPhilippineTime(now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }))
      setPhilippineWeekday(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short' }).format(now))
    }
    updatePhilippineTime()
    const timer = window.setInterval(updatePhilippineTime, 15_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setStation(getStoredStation())
    setPlayerPreferences(readPlayerPreferences())
    const onStationChange = (event: Event) => {
      const next = (event as CustomEvent<StationId>).detail
      if (next) setStation(next)
    }
    window.addEventListener('morefm:station-change', onStationChange)
    const onDiscoverSelect = (event: Event) => {
      const next = (event as CustomEvent<StationId>).detail
      if (!next) return
      setStation(next)
      setExternalStation(null)
      setExternalPlaying(false)
      unlockAction.current()
      setPlaying(true)
    }
    window.addEventListener('morefm:select-station', onDiscoverSelect)
    const update = (event: Event) => setPlayerPreferences((event as CustomEvent<PlayerPreferences>).detail)
    window.addEventListener('morefm-player-preferences', update)
    return () => {
      window.removeEventListener('morefm-player-preferences', update)
      window.removeEventListener('morefm:station-change', onStationChange)
      window.removeEventListener('morefm:select-station', onDiscoverSelect)
    }
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
    if (!dearMorBlocktime) return
    setPlaying(false)
    setExternalPlaying(false)
    externalAudioRef.current?.pause()
    stationVideoRef.current?.pause()
    setStationVideoPlaying(false)
  }, [dearMorBlocktime])
  unlockAction.current = unlock

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

  // Device-local estimate: 32 kbps AAC-LC target = 4,000 bytes per active second.
  // Persisted in localStorage so normal website/APK updates do not reset the totals.
  useEffect(() => {
    if (!live || externalStation) return
    const tick = () => {
      try {
        const key = 'rjfm_data_usage_v1'
        const saved = JSON.parse(window.localStorage.getItem(key) || '{}')
        const day = new Date().toLocaleDateString('en-CA')
        const days = saved.days && typeof saved.days === 'object' ? saved.days : {}
        const bytes = 4000
        const next = {
          totalBytes: (Number(saved.totalBytes) || 0) + bytes,
          totalSeconds: (Number(saved.totalSeconds) || 0) + 1,
          days: { ...days, [day]: (Number(days[day]) || 0) + bytes },
          updatedAt: new Date().toISOString(),
        }
        window.localStorage.setItem(key, JSON.stringify(next))
        window.dispatchEvent(new Event('rjfm:usage-update'))
      } catch { /* Device storage may be disabled or full. */ }
    }
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [live, externalStation])
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
    if (stationVideoPlaying || (video && !video.paused)) {
      video?.pause()
      setStationVideoPlaying(false)
      setPlaying(false)
      return
    }
    // Start RJ FM audio directly from the tap; a video decode/autoplay issue
    // must never disable the main Play button or prevent radio audio.
    unlock()
    setPlaying(true)
    if (video) {
      video.muted = true
      try { video.currentTime = 0 } catch { /* wait for metadata */ }
      void video.play()
        .then(() => setStationVideoPlaying(true))
        .catch(() => setStationVideoPlaying(false))
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
    <section aria-label={`${meta.name} ${meta.frequency} live player`} className={`radio-player radio-player-card flex w-full flex-col items-center text-center bg-[#17191f] text-white ${playerPreferences.compact ? 'gap-3' : 'gap-4'} ${playerPreferences.showBorder ? 'border border-primary/20' : 'border-0'}`}>
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

      <div className="w-full max-w-2xl overflow-hidden rounded-[1.6rem] border border-white/20 bg-[#17191f] shadow-[0_22px_55px_rgba(0,0,0,.42)]">
        <div className="relative aspect-video w-full overflow-hidden bg-[#17191f]">
            <>
          {dearMorBlocktime ? (
            <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#7f1d3b_0%,#3b102c_48%,#100d1c_100%)] px-5 text-center" role="img" aria-label="Dear MOR logo">
              <div className="absolute inset-0 opacity-25" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 20% 25%, #fbcfe8 0 2px, transparent 3px), radial-gradient(circle at 78% 72%, #fda4af 0 2px, transparent 3px)', backgroundSize: '54px 54px' }} />
              <div className="relative flex size-24 items-center justify-center rounded-full border-4 border-amber-200 bg-white shadow-[0_0_35px_rgba(251,191,36,.35)]">
                <span className="text-3xl font-black tracking-tighter text-rose-700">MOR</span>
              </div>
              <div className="relative mt-5 text-4xl font-black tracking-[0.12em] text-white drop-shadow-[0_3px_8px_rgba(0,0,0,.6)] sm:text-5xl">DEAR <span className="text-amber-300">MOR</span></div>
              <div className="relative mt-2 text-xs font-semibold uppercase tracking-[0.38em] text-rose-100/90">Stories of Love</div>
              <div className="relative mt-5 rounded-full border border-rose-200/50 bg-black/20 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-rose-100">RJ FM Special Blocktime</div>
            </div>

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
            </>
          )}
          {!playing && !stationVideoPlaying && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15" aria-hidden="true" />
          )}
          {!dearMorBlocktime && !stationVideoPlaying && (
            <button
              type="button"
              onClick={toggleStationVideo}
              aria-label={`Play ${meta.name}`}
              className="radio-play-overlay flex size-[4.5rem] items-center justify-center rounded-full border-2 border-white/85 bg-black/60 text-white shadow-[0_0_0_8px_rgba(255,255,255,.14),0_10px_28px_rgba(0,0,0,.45)] backdrop-blur-md transition hover:scale-105 hover:bg-black/75 active:scale-95"
            >
              <Play className="size-8 translate-x-0.5" />
            </button>
          )}
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
