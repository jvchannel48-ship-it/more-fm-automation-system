'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Mail, RefreshCw, Settings, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { readCustomPlayerHtml, saveCustomPlayerHtml, removeCustomPlayerHtml } from '@/lib/custom-player-storage'
import { DEFAULT_PLAYER_PREFERENCES, readPlayerPreferences, savePlayerPreferences, type PlayerPreferences } from '@/lib/player-preferences'

const STAY_AWAKE_KEY = 'morefm_stay_awake'
const CUSTOM_PLAYER_KEY = 'rjfm_custom_player_html_v1'
const MAX_CUSTOM_HTML = 6 * 1024 * 1024

type WakeLockLike = { released: boolean; release: () => Promise<void>; addEventListener?: (type: 'release', listener: () => void) => void }
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockLike> } }

export function SettingsPanel({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(embedded)
  const [stayAwake, setStayAwake] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [awakeError, setAwakeError] = useState('')
  const [preferences, setPreferences] = useState<PlayerPreferences>(DEFAULT_PLAYER_PREFERENCES)
  const [customFileName, setCustomFileName] = useState('')
  const [customHtml, setCustomHtml] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [reportSubject, setReportSubject] = useState('')
  const [reportMessage, setReportMessage] = useState('')
  const [reportStatus, setReportStatus] = useState('')
  const wakeLock = useRef<WakeLockLike | null>(null)

  useEffect(() => {
    try {
      setStayAwake(window.localStorage.getItem(STAY_AWAKE_KEY) === 'true')
      void readCustomPlayerHtml().then((savedHtml) => { setCustomHtml(savedHtml); setCustomFileName(savedHtml ? 'Custom player uploaded' : '') }).catch(() => undefined)
    } catch { setStayAwake(false) }
    setPreferences(readPlayerPreferences())
  }, [])

  const savePreferences = (patch: Partial<PlayerPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch }
      savePlayerPreferences(next)
      return next
    })
  }

  const releaseWakeLock = useCallback(async () => {
    const current = wakeLock.current
    wakeLock.current = null
    if (current && !current.released) await current.release().catch(() => undefined)
  }, [])

  const requestWakeLock = useCallback(async () => {
    const api = navigator as WakeLockNavigator
    if (!api.wakeLock) { setAwakeError('Hindi suportado ng browser ang Stay Awake.'); return false }
    try {
      wakeLock.current = await api.wakeLock.request('screen')
      wakeLock.current.addEventListener?.('release', () => { wakeLock.current = null })
      setAwakeError('')
      return true
    } catch { setAwakeError('Hindi ma-activate ang Stay Awake. Subukan habang bukas ang app.'); return false }
  }, [])

  useEffect(() => {
    if (!stayAwake) { void releaseWakeLock(); return }
    const reacquire = () => { if (document.visibilityState === 'visible' && !wakeLock.current) void requestWakeLock() }
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

  const uploadCustomPlayer = async (file?: File) => {
    setUploadMessage('')
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.html') && file.name.toLowerCase() !== 'index.html') {
      setUploadMessage('HTML file lang ang puwedeng i-upload.')
      return
    }
    if (file.size > MAX_CUSTOM_HTML) {
      setUploadMessage('Hanggang 1 MB lang ang custom player HTML file.')
      return
    }
    const source = await file.text()
    if (!/<html[\s>]|<!doctype html|<body[\s>]/i.test(source)) {
      setUploadMessage('Hindi mukhang kumpletong HTML player file ito.')
      return
    }
    try {
      await saveCustomPlayerHtml(source)
      setCustomHtml(source)
      setCustomFileName(file.name)
      setUploadMessage('Na-save ang custom speaker. Makikita ito sa Home player.')
      window.dispatchEvent(new CustomEvent('rjfm:custom-player-change', { detail: source }))
    } catch {
      setUploadMessage('Hindi na-save: kulang ang browser storage. Gumamit ng mas maliit na HTML file.')
    }
  }

  const removeCustomPlayer = () => {
    void removeCustomPlayerHtml().catch(() => undefined)
    setCustomHtml('')
    setCustomFileName('')
    setUploadMessage('Inalis ang custom HTML. Bumalik sa built-in player.')
    window.dispatchEvent(new CustomEvent('rjfm:custom-player-change', { detail: '' }))
  }

  const sendReport = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reportMessage.trim()) { setReportStatus('Ilagay muna ang detalye ng problema.'); return }
    const subject = encodeURIComponent(reportSubject.trim() || 'RJ FM App Problem Report')
    const body = encodeURIComponent(reportMessage.trim())
    setReportStatus('Binubuksan ang email app para ipadala sa rjfmphilippines@gmail.com. Hindi pa ito confirmed delivered hangga’t hindi naipapadala sa email app.')
    window.location.href = `mailto:rjfmphilippines@gmail.com?subject=${subject}&body=${body}`
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
        <div className={embedded ? 'relative z-10 w-full' : 'fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm'} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="settings-title" className={`relative w-full ${embedded ? 'mx-auto max-w-3xl' : 'max-w-md'} max-h-[85vh] overflow-y-auto rounded-3xl border border-primary/25 bg-card p-6 text-left shadow-2xl`}>
            {!embedded && <Button type="button" variant="ghost" size="icon-sm" aria-label="Close settings" onClick={() => setOpen(false)} className="absolute right-4 top-4"><X /></Button>}
            <div className="flex items-center gap-3 pr-8">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Settings aria-hidden="true" /></span>
              <div><h2 id="settings-title" className="text-xl font-semibold">RJ FM Customize</h2><p className="text-sm text-muted-foreground">Player, speaker lights, logo at support</p></div>
            </div>

            <div className="mt-6 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <h3 className="font-semibold">Customize Player</h3>
              <label className="mt-3 block text-xs text-muted-foreground" htmlFor="rj-player-style">Player display</label>
              <select id="rj-player-style" value={preferences.playerStyle} onChange={(e) => savePreferences({ playerStyle: e.target.value as PlayerPreferences['playerStyle'] })} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <option value="vinyl">RJ FM classic player</option><option value="speakers">3D dual speakers</option><option value="none">None – default player</option><option value="radio">Radio style</option><option value="headphones">Headphones style</option>
              </select>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-xs text-muted-foreground">Logo / accent color<input aria-label="Logo accent color" type="color" value={preferences.accentColor} onChange={(e) => savePreferences({ accentColor: e.target.value })} className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-border bg-background p-1" /></label>
                <label className="text-xs text-muted-foreground">Speaker light color<input aria-label="Speaker light color" type="color" value={preferences.speakerLight} onChange={(e) => savePreferences({ speakerLight: e.target.value })} className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-border bg-background p-1" /></label>
              </div>
              <label className="mt-4 flex items-center justify-between gap-3 text-sm"><span>Show volume control</span><input type="checkbox" checked={preferences.showVolume} onChange={(e) => savePreferences({ showVolume: e.target.checked })} /></label>
              <label className="mt-3 flex items-center justify-between gap-3 text-sm"><span>Player border / glow</span><input type="checkbox" checked={preferences.showBorder} onChange={(e) => savePreferences({ showBorder: e.target.checked })} /></label>
              <label className="mt-3 flex items-center justify-between gap-3 text-sm"><span>Compact player</span><input type="checkbox" checked={preferences.compact} onChange={(e) => savePreferences({ compact: e.target.checked })} /></label>
              <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => savePreferences(DEFAULT_PLAYER_PREFERENCES)}>Reset player customization</Button>
            </div>

            <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <div className="flex items-center gap-2"><Upload className="size-4 text-primary" /><h3 className="font-semibold">Upload Custom Speaker (index.html)</h3></div>
                      <input type="file" accept=".html,text/html" aria-label="Upload custom player HTML file" onChange={(e) => void uploadCustomPlayer(e.target.files?.[0])} className="mt-3 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:font-semibold file:text-primary-foreground" />
              {customFileName && <p className="mt-2 text-xs text-emerald-300">Loaded: {customFileName}</p>}
              {customHtml && <Button type="button" variant="outline" className="mt-3 w-full" onClick={removeCustomPlayer}>Remove custom player / Restore default</Button>}
              {uploadMessage && <p className="mt-2 text-xs text-muted-foreground" role="status">{uploadMessage}</p>}
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <div><p className="font-medium">Stay Awake</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Panatilihing gising ang screen habang nakikinig.</p></div>
              <button type="button" role="switch" aria-checked={stayAwake} onClick={toggleStayAwake} className={`relative h-7 w-12 shrink-0 rounded-full transition ${stayAwake ? 'bg-primary' : 'bg-muted'}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${stayAwake ? 'left-6' : 'left-1'}`} /><span className="sr-only">{stayAwake ? 'Stay Awake on' : 'Stay Awake off'}</span></button>
            </div>
            {awakeError && <p className="mt-3 text-xs text-amber-300" role="status">{awakeError}</p>}

            <form onSubmit={sendReport} className="mt-4 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <div className="flex items-center gap-2"><Mail className="size-4 text-primary" /><h3 className="font-semibold">Report Problem</h3></div>
              <p className="mt-1 text-xs text-muted-foreground">Ipadala ang problema sa RJ FM support.</p>
              <input value={reportSubject} onChange={(e) => setReportSubject(e.target.value)} placeholder="Subject (optional)" className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              <textarea required value={reportMessage} onChange={(e) => setReportMessage(e.target.value)} placeholder="Ilarawan ang problema…" rows={4} className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              <Button type="submit" className="mt-3 w-full"><Mail className="size-4" /> Message RJ FM Support</Button>
              <p className="mt-2 break-all text-xs text-muted-foreground">rjfmphilippines@gmail.com</p>
              {reportStatus && <p className="mt-2 text-xs text-amber-200" role="status">{reportStatus}</p>}
            </form>

            <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/50 p-4">
              <p className="font-medium">App update</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">I-refresh ang app at i-load ang pinakabagong website files.</p>
              <Button type="button" variant="outline" className="mt-3 w-full" onClick={updateApp} disabled={updating}>{updating ? <RefreshCw className="animate-spin" /> : <Check />}{updating ? 'Updating…' : 'Update app'}</Button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
