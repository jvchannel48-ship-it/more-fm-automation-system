'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, RefreshCw, Settings, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DEFAULT_PLAYER_PREFERENCES, readPlayerPreferences, savePlayerPreferences, type PlayerPreferences } from '@/lib/player-preferences'

const STAY_AWAKE_KEY = 'morefm_stay_awake'

type WakeLockLike = {
  released: boolean
  release: () => Promise<void>
  addEventListener?: (type: 'release', listener: () => void) => void
}

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockLike> }
}

export function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const [stayAwake, setStayAwake] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [awakeError, setAwakeError] = useState('')
  const [playerPreferences, setPlayerPreferences] = useState<PlayerPreferences>(DEFAULT_PLAYER_PREFERENCES)
  const wakeLock = useRef<WakeLockLike | null>(null)

  useEffect(() => {
    try {
      setStayAwake(window.localStorage.getItem(STAY_AWAKE_KEY) === 'true')
      setPlayerPreferences(readPlayerPreferences())
    } catch {
      setStayAwake(false)
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    const current = wakeLock.current
    wakeLock.current = null
    if (current && !current.released) await current.release().catch(() => undefined)
  }, [])

  const requestWakeLock = useCallback(async () => {
    const api = navigator as WakeLockNavigator
    if (!api.wakeLock) {
      setAwakeError('Hindi supported ng browser na ito ang Stay Awake.')
      return false
    }
    try {
      wakeLock.current = await api.wakeLock.request('screen')
      wakeLock.current.addEventListener?.('release', () => {
        wakeLock.current = null
      })
      setAwakeError('')
      return true
    } catch {
      setAwakeError('Hindi ma-activate ang Stay Awake. Subukan ulit habang bukas ang page.')
      return false
    }
  }, [])

  useEffect(() => {
    if (!stayAwake) {
      void releaseWakeLock()
      return
    }
    const reacquire = () => {
      if (document.visibilityState === 'visible' && !wakeLock.current) void requestWakeLock()
    }
    void requestWakeLock()
    document.addEventListener('visibilitychange', reacquire)
    return () => document.removeEventListener('visibilitychange', reacquire)
  }, [releaseWakeLock, requestWakeLock, stayAwake])

  useEffect(() => () => { void releaseWakeLock() }, [releaseWakeLock])

  const toggleStayAwake = () => {
    const next = !stayAwake
    setStayAwake(next)
    setAwakeError('')
    try { window.localStorage.setItem(STAY_AWAKE_KEY, String(next)) } catch { /* storage may be blocked */ }
  }

  const updatePlayer = <K extends keyof PlayerPreferences>(key: K, value: PlayerPreferences[K]) => {
    const next = { ...playerPreferences, [key]: value }
    setPlayerPreferences(next)
    savePlayerPreferences(next)
  }

  const updateApp = async () => {
    setUpdating(true)
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
      }
    } finally {
      const url = new URL(window.location.href)
      url.searchParams.set('app_update', String(Date.now()))
      window.location.replace(url.toString())
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Settings"
        title="Settings"
        onClick={() => setOpen(true)}
      >
        <Settings aria-hidden="true" />
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="settings-title" className="relative w-full max-w-md rounded-3xl border border-primary/25 bg-card p-6 text-left shadow-2xl">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Close settings" onClick={() => setOpen(false)} className="absolute right-4 top-4"><X /></Button>
            <div className="flex items-center gap-3 pr-8">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Settings aria-hidden="true" /></span>
              <div>
                <h2 id="settings-title" className="text-xl font-semibold">Settings</h2>
                <p className="text-sm text-muted-foreground">Playback at manatiling updated ang app</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <div>
                <p className="font-medium">Stay Awake</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Huwag i-sleep ang screen habang nakikinig. Mananatili ang setting sa device na ito.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={stayAwake}
                onClick={toggleStayAwake}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${stayAwake ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${stayAwake ? 'left-6' : 'left-1'}`} />
                <span className="sr-only">{stayAwake ? 'Stay Awake on' : 'Stay Awake off'}</span>
              </button>
            </div>
            {awakeError && <p className="mt-3 text-xs text-amber-300" role="status">{awakeError}</p>}

            <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <p className="font-medium">Player customization</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Customize lang sa device na ito; hindi maaapektuhan ang ibang listeners.</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {([
                  ['compact', 'Compact player'],
                  ['showVolume', 'Show volume'],
                  ['showBorder', 'Show border'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
                    <input type="checkbox" checked={playerPreferences[key]} onChange={(event) => updatePlayer(key, event.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">Background
                  <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={playerPreferences.background} onChange={(event) => updatePlayer('background', event.target.value as PlayerPreferences['background'])}>
                    <option value="night">Night</option><option value="ocean">Ocean</option><option value="sunset">Sunset</option>
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">Volume icon
                  <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={playerPreferences.volumeIcon} onChange={(event) => updatePlayer('volumeIcon', event.target.value as PlayerPreferences['volumeIcon'])}>
                    <option value="speaker">Speaker</option><option value="minimal">Minimal</option><option value="waves">Waves</option>
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">Vinyl color
                  <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={playerPreferences.vinylColor} onChange={(event) => updatePlayer('vinylColor', event.target.value as PlayerPreferences['vinylColor'])}>
                    <option value="silver">Silver</option><option value="gold">Gold</option><option value="blue">Blue</option><option value="red">Red</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <p className="font-medium">App update</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">I-clear ang lumang browser cache at i-load ang latest features at code.</p>
              <Button type="button" variant="outline" className="mt-3 w-full" onClick={updateApp} disabled={updating}>
                {updating ? <RefreshCw className="animate-spin" /> : <Check />}
                {updating ? 'Updating…' : 'Update app'}
              </Button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
