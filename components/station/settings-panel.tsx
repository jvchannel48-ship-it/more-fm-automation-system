'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Check, RefreshCw, Settings, ShieldCheck, X } from 'lucide-react'
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

const APK_PERMISSIONS = [
  { name: 'WAKE_LOCK', detail: 'Panatilihing gising ang audio service habang tumutugtog.' },
  { name: 'FOREGROUND_SERVICE', detail: 'Payagan ang Android foreground playback service.' },
  { name: 'FOREGROUND_SERVICE_MEDIA_PLAYBACK', detail: 'Media playback service permission para sa Android 14 pataas.' },
  { name: 'POST_NOTIFICATIONS', detail: 'Ipakita ang RJ FM playback notification sa Android 13 pataas.' },
  { name: 'ACCESS_NETWORK_STATE', detail: 'Basahin kung may network connection ang device.' },
] as const

export function SettingsPanel({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(embedded)
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
      setPushError(error instanceof Error ? error.message : 'Hindi ma-request ang notification permission.')
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
      setAwakeError('Hindi suportado ng browser ang Stay Awake.')
      return false
    }
    try {
      wakeLock.current = await api.wakeLock.request('screen')
      wakeLock.current.addEventListener?.('release', () => { wakeLock.current = null })
      setAwakeError('')
      return true
    } catch {
      setAwakeError('Hindi ma-activate ang Stay Awake. Subukan habang bukas ang app.')
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
      {!embedded && <Button type="button" variant="ghost" size="icon" aria-label="Settings" title="Settings" onClick={() => setOpen(true)}><Settings aria-hidden="true" /></Button>}
      {open && (
        <div
          className={`${embedded ? 'relative z-10 w-full' : 'fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm'}`}
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="settings-title" className={`relative w-full ${embedded ? 'mx-auto max-w-3xl' : 'max-w-md'} rounded-3xl border border-primary/25 bg-card p-6 text-left shadow-2xl`}>
            {!embedded && <Button type="button" variant="ghost" size="icon-sm" aria-label="Close settings" onClick={() => setOpen(false)} className="absolute right-4 top-4"><X /></Button>}
            <div className="flex items-center gap-3 pr-8">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Settings aria-hidden="true" /></span>
              <div>
                <h2 id="settings-title" className="text-xl font-semibold">RJ FM Settings</h2>
                <p className="text-sm text-muted-foreground">Permissions at playback controls</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><p className="font-medium">Android APK permissions</p></div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Kasama ang mga permission na ito sa Android APK build. Hindi sila puwedeng i-on/off bilang ordinaryong website switch; ang Android system ang namamahala sa access.</p>
              <div className="mt-3 space-y-3">
                {APK_PERMISSIONS.map((permission) => (
                  <div key={permission.name} className="flex items-start justify-between gap-3 border-t border-border/60 pt-3">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-medium">{permission.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{permission.detail}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-400"><Check className="size-3" /> APK manifest</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <div className="flex items-center gap-2"><Bell className="size-4 text-primary" /><p className="font-medium">Notification permission</p></div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">I-allow ang notifications para makita ang RJ FM playback notification. Sa Android 13 pataas, kailangan itong aprubahan sa system prompt.</p>
              <Button type="button" variant="outline" className="mt-3 w-full" onClick={enableNotifications} disabled={pushBusy || pushStatus === true}>
                {pushBusy ? 'Requesting permission…' : pushStatus === true ? 'Notifications enabled' : pushStatus === false ? 'Enable notifications' : 'Available in installed Android APK'}
              </Button>
              {pushError && <p className="mt-2 text-xs text-amber-300" role="status">{pushError}</p>}
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <div>
                <p className="font-medium">Stay Awake</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Panatilihing bukas ang screen habang nakikinig. Naka-save sa device na ito.</p>
              </div>
              <button type="button" role="switch" aria-checked={stayAwake} onClick={toggleStayAwake} className={`relative h-7 w-12 shrink-0 rounded-full transition ${stayAwake ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${stayAwake ? 'left-6' : 'left-1'}`} />
                <span className="sr-only">{stayAwake ? 'Stay Awake on' : 'Stay Awake off'}</span>
              </button>
            </div>
            {awakeError && <p className="mt-3 text-xs text-amber-300" role="status">{awakeError}</p>}

            <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <p className="font-medium">App update</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">I-refresh ang app at i-load ang pinakabagong website files.</p>
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
