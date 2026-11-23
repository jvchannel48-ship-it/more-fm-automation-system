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
import { readCustomPlayerHtml } from '@/lib/custom-player-storage'
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
  const externalAudioRef = useRef<HTMLAudioElement>(null)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [recoveryIssue, setRecoveryIssue] = useState<string | null>(null)
  const [station, setStation] = useState<StationId>('main')
  const [playerPreferences, setPlayerPreferences] = useState<PlayerPreferences>(DEFAULT_PLAYER_PREFERENCES)
  const [customPlayerHtml, setCustomPlayerHtml] = useState('')
  const [apkDownloadHidden, setApkDownloadHidden] = useState(false)
  const listenerId = useRef<string | null>(null)
  const unlockAction = useRef<() => void>(() => undefined)

  useEffect(() => {
    setStation(getStoredStation())
    try { setApkDownloadHidden(window.localStorage.getItem('rjfm_apk_downloaded_v1') === 'true') } catch { setApkDownloadHidden(false) }
    setPlayerPreferences(readPlayerPreferences())
    void readCustomPlayerHtml().then(setCustomPlayerHtml).catch(() => setCustomPlayerHtml(''))
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
    const onCustomPlayerChange = (event: Event) => setCustomPlayerHtml((event as CustomEvent<string>).detail || '')
    window.addEventListener('rjfm:custom-player-change', onCustomPlayerChange)
    return () => {
      window.removeEventListener('morefm-player-preferences', update)
      window.removeEventListener('rjfm:custom-player-change', onCustomPlayerChange)
      window.removeEventListener('morefm:station-change', onStationChange)
      window.removeEventListener('morefm:select-station', onDiscoverSelect)
    }
  }, [])

  useEffect(() => {
    const checkDzmmSchedule = () => {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date())
      const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
      const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
      const mins = hour * 60 + minute
      const isDzmmStation = station === 'main' || station === 'naga' || station === 'calabanga'
      const isCebuDavao = station === 'cebu' || station === 'davao'
      const signOff = isDzmmStation && mins >= 3 * 60 && mins < 4 * 60
      const scheduled = (isDzmmStation && (mins >= 12 * 60 && mins < 13 * 60 || mins >= 18 * 60 + 28 && mins < 20 * 60 || mins >= 22 * 60 || mins < 3 * 60))
        || (isCebuDavao && mins >= 18 * 60 + 28 && mins < 20 * 60)
      const audio = externalAudioRef.current
      if (!audio) return
      if (signOff) {
        audio.pause()
        if (externalStation?.name === 'DZMM') setExternalStation(null)
        setExternalPlaying(false)
        setPlaying(false)
      } else if (scheduled) {
        if (externalStation?.name === 'DZMM' && externalPlaying) return
        setPlaying(false)
        setExternalStation({ name: 'DZMM', url_resolved: 'https://us1.amfmph.com:8852/live' })
        audio.src = 'https://us1.amfmph.com:8852/live'
        void audio.play().then(() => setExternalPlaying(true)).catch(() => setExternalPlaying(false))
      } else if (externalStation?.name === 'DZMM') {
        audio.pause()
        setExternalStation(null)
        setExternalPlaying(false)
        setPlaying(true)
      }
    }
    checkDzmmSchedule()
    const timer = window.setInterval(checkDzmmSchedule, 15000)
    return () => window.clearInterval(timer)
  }, [station, externalStation, externalPlaying])

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
    <section aria-label={`${meta.name} ${meta.frequency} live player`} className={`radio-player radio-player-card flex w-full flex-col items-center text-center bg-[#17191f] text-white ${playerPreferences.background === 'ocean' ? 'player-theme-ocean' : playerPreferences.background === 'sunset' ? 'player-theme-sunset' : 'player-theme-night'} ${playerPreferences.compact ? 'gap-3' : 'gap-4'} ${playerPreferences.showBorder ? 'border border-primary/20' : 'border-0'}`}>
      {!Capacitor.isNativePlatform() && !apkDownloadHidden && <a href="https://github.com/jvchannel48-ship-it/more-fm-automation-system/releases/download/android-latest/rj-fm-android.apk" onClick={() => { setApkDownloadHidden(true); try { window.localStorage.setItem('rjfm_apk_downloaded_v1', 'true') } catch { /* ignore */ } }} className="mb-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/40 bg-gradient-to-b from-cyan-300 to-blue-500 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-[0_7px_0_#123a70,0_12px_25px_rgba(14,165,233,.28)] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_3px_0_#123a70,0_5px_12px_rgba(14,165,233,.25)]" download>
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

      {customPlayerHtml ? (
        <iframe title="RJ FM custom speaker player" srcDoc={customPlayerHtml} sandbox="allow-scripts" referrerPolicy="no-referrer" className="aspect-video w-full max-w-2xl overflow-hidden rounded-[1.6rem] border border-white/20 bg-black shadow-2xl" />
      ) : playerPreferences.playerStyle === 'speakers' ? (
        <div className="relative flex aspect-[3/4] w-full max-w-sm flex-col items-center justify-center gap-5 overflow-hidden rounded-[1.6rem] border border-white/15 bg-[radial-gradient(ellipse_at_center,#26364b_0%,#101923_55%,#05080d_100%)] px-4 py-6 shadow-2xl" style={{ ['--speaker-light' as string]: playerPreferences.speakerLight }}>
          {[0, 1].map((speaker) => (
            <div key={speaker} className={'relative z-10 flex aspect-square w-[58%] max-w-[220px] shrink-0 items-center justify-center rounded-full border-[5px] border-slate-500/80 bg-[radial-gradient(circle_at_35%_25%,#687386_0%,#252d3a_22%,#080b12_70%)] p-[5%] shadow-[inset_0_0_22px_rgba(255,255,255,.18),0_15px_28px_rgba(0,0,0,.7)] ' + (live ? 'rj-speaker-live' : '')}>
              <div className="absolute inset-[5%] rounded-full border border-white/20 bg-[repeating-radial-gradient(circle,#252b36_0_3px,#111722_4px_7px)] shadow-inner" />
              <div className={'relative flex aspect-square w-[68%] items-center justify-center rounded-full border-[5px] border-slate-400/80 bg-[radial-gradient(circle_at_35%_30%,#818b9b_0%,#323b49_25%,#080b11_72%)] shadow-inner ' + (live ? 'rj-speaker-cone' : '')}>
                <div className="absolute inset-[12%] rounded-full border-[3px] border-white/20 bg-[radial-gradient(circle_at_35%_30%,#384252,#090d14_75%)]" />
                <div className="relative size-[24%] rounded-full border-2 border-white/30 bg-[radial-gradient(circle_at_35%_25%,#fff,#8b929d_35%,#242b36_75%)]" style={{ boxShadow: '0 0 18px ' + playerPreferences.speakerLight }} />
              </div>
              <div className={'absolute inset-[2%] rounded-full border-[3px] border-transparent ' + (live ? 'rj-speaker-led' : '')} />
            </div>
          ))}
          <div className="absolute bottom-3 left-0 right-0 z-20 flex items-center justify-center gap-2 text-[10px] font-black tracking-[.32em] text-white/80"><span className={'size-2 rounded-full ' + (live ? 'animate-pulse bg-red-400 shadow-[0_0_12px_#fb7185]' : 'bg-slate-500')} /> RJ FM DUAL SPEAKERS</div>
          <style jsx>{`
            .rj-speaker-live { animation: speakerGlow 1.1s ease-in-out infinite alternate; }
            .rj-speaker-cone { animation: conePulse .32s ease-in-out infinite alternate; }
            .rj-speaker-led { border-color: var(--speaker-light); box-shadow: 0 0 9px var(--speaker-light), inset 0 0 9px var(--speaker-light); animation: ledBlink .75s steps(2,end) infinite; }
            @keyframes speakerGlow { from { box-shadow: 0 0 8px var(--speaker-light); } to { box-shadow: 0 0 22px var(--speaker-light); } }
            @keyframes conePulse { from { transform: scale(.97); } to { transform: scale(1.035); } }
            @keyframes ledBlink { from { opacity: .45; } to { opacity: 1; } }
            @media (prefers-reduced-motion: reduce) { .rj-speaker-live,.rj-speaker-cone,.rj-speaker-led { animation: none; } }
          `}</style>
        </div>
      ) : playerPreferences.playerStyle === 'circle' ? (
        <div className="flex aspect-square w-full max-w-sm items-center justify-center rounded-full bg-slate-950 p-5 shadow-2xl">
          <div className={'relative flex aspect-square w-full items-center justify-center rounded-full border-[10px] border-slate-500 bg-[repeating-radial-gradient(circle,#252b36_0_3px,#111722_4px_8px)] shadow-[inset_0_0_30px_rgba(0,0,0,.9),0_0_28px_rgba(34,211,238,.22)] ' + (live ? 'rj-circle-roll' : '')}>
            <div className="absolute inset-[18%] rounded-full border-4 border-white/15 bg-[radial-gradient(circle_at_35%_25%,#596779,#101722_70%)]" />
            <div className="relative z-10 flex size-[34%] items-center justify-center rounded-full border-4 border-slate-400 bg-slate-900 text-xl font-black italic text-white shadow-xl">RJ</div>
            <span className="absolute bottom-[12%] z-10 text-[10px] font-black tracking-[.35em] text-white">RJ FM</span>
          </div>
          <style jsx>{`@keyframes rjCircleRoll { to { transform: rotate(360deg); } } .rj-circle-roll { animation: rjCircleRoll 9s linear infinite; } @media (prefers-reduced-motion: reduce) { .rj-circle-roll { animation: none; } }`}</style>
        </div>
      ) : (
        <div className="w-full max-w-2xl overflow-hidden rounded-[1.6rem] border border-white/20 bg-[#17191f] shadow-[0_22px_55px_rgba(0,0,0,.42)]">
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#26364b_0%,#111923_48%,#080b10_100%)]">
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="flex size-28 items-center justify-center rounded-full border-[5px] bg-[radial-gradient(circle_at_35%_25%,#fff4c2_0%,#d99a32_28%,#761d25_68%,#26090c_100%)] p-1 sm:size-36" style={{ borderColor: playerPreferences.accentColor, boxShadow: '0 0 0 5px rgba(255,255,255,.12), 0 0 38px ' + playerPreferences.accentColor + '66' }}>
                <div className="flex size-full flex-col items-center justify-center rounded-full border border-amber-100/70 bg-black/25 text-center"><span className="text-[9px] font-black tracking-[.34em] text-amber-100 sm:text-[10px]">YOUR STATION</span><span className="mt-1 text-2xl font-black italic tracking-tight text-white drop-shadow sm:text-3xl">RJ FM</span><span className="mt-0.5 max-w-[95px] truncate text-[9px] font-extrabold uppercase tracking-[.16em] text-amber-100 sm:max-w-[120px] sm:text-[10px]">{meta.city}</span></div>
              </div>
            </div>
            {!playing && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15" aria-hidden="true" />}
            {!playing && <button type="button" onClick={() => { unlock(); setPlaying(true) }} aria-label={`Play ${meta.name}`} className="radio-play-overlay flex size-[4.5rem] items-center justify-center rounded-full border-2 border-white/85 bg-black/60 text-white shadow-[0_0_0_8px_rgba(255,255,255,.14),0_10px_28px_rgba(0,0,0,.45)] backdrop-blur-md transition hover:scale-105 hover:bg-black/75 active:scale-95"><Play className="size-8 translate-x-0.5" /></button>}
          </div>
          <div className="flex items-center justify-center gap-2 border-t border-white/10 bg-gradient-to-r from-[#26090c] via-[#7f1019] to-[#26090c] px-4 py-3 text-sm font-black tracking-[0.28em] text-white"><span className="size-2 animate-pulse rounded-full bg-red-400" aria-hidden="true" /> LIVE</div>
        </div>
      )}

      <style jsx global>{`.player-theme-ocean { background: linear-gradient(145deg,#071d35,#123f65,#081827) !important; } .player-theme-sunset { background: linear-gradient(145deg,#301044,#742c5b,#17101f) !important; } .player-theme-night { background: #17191f !important; }`}</style>
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
