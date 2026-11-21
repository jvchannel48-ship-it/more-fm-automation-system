'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Check, RefreshCw, Settings, X } from 'lucide-react'
import { getPushPermissionStatus, requestPushPermission } from '@/lib/app-permissions'
import { Button } from '@/components/ui/button'

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
  const [pushStatus, setPushStatus] = useState<boolean | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const wakeLock = useRef<WakeLockLike | null>(null)

  useEffect(() => {
    try {
      setStayAwake(window.localStorage.getItem(STAY_AWAKE_KEY) === 'true')
    } catch {
      setStayAwake(false)
    }
    void getPushPermissionStatus().then(setPushStatus).catch(() => setPushStatus(null))
  }, [])

  const enableNotifications = async () => {
    setPushBusy(true)
    setPushError('')
    try {
      setPushStatus(await requestPushPermission())
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'Could not request notification permission.')
    } finally {
      setPushBusy(false)
    }
  }

  const releaseWakeLock = useCallback(async () => {
    const current = wakeLock.current
    wakeLock.current = null
    if (current && !current.released) await current.release().catch(() => undefined)
  }, [])

  const requestWakeLock = useCallback(async () => {
    const api = navigator as WakeLockNavigator
    if (!api.wakeLock) {
      setAwakeError('Stay Awake is not supported in this browser.')
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
      setAwakeError('Could not activate Stay Awake. Try again while the page is open.')
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
                <p className="text-sm text-muted-foreground">Playback and app updates</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <div>
                <p className="font-medium">Stay Awake</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Keep the screen on while listening. Saved on this device only.</p>
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
              <div className="flex items-center gap-2"><Bell className="size-4 text-primary" /><p className="font-medium">Notifications & lock-screen player</p></div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Allow RJ FM notifications in the installed Android app. While playing, Android media controls can show Play/Pause and station artwork on the lock screen.</p>
              <Button type="button" variant="outline" className="mt-3 w-full" onClick={enableNotifications} disabled={pushBusy || pushStatus === true || pushStatus === null}>
                {pushBusy ? 'Requesting permission…' : pushStatus === true ? 'Notifications enabled' : pushStatus === false ? 'Enable notifications' : 'Available in Android app'}
              </Button>
              {pushError && <p className="mt-2 text-xs text-amber-300" role="status">{pushError}</p>}
              <p className="mt-2 text-[11px] text-muted-foreground">Nearby Devices access is not required for radio playback; it is only needed if RJ FM adds Bluetooth device discovery.</p>
            </div>

            <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <p className="font-medium">App update</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Clear old browser cache and load the latest features.</p>
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
