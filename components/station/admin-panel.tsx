'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Clock3, Database, MapPin, Mic2, RefreshCw, Square, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { AdminStatus } from '@/lib/types'
import { SongsPlaylistManager } from './songs-playlist-manager'

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  const result = await response.json().catch(() => null) as (AdminStatus & { error?: string }) | null
  if (!response.ok) throw new Error(result?.error ?? (response.status === 401 ? 'Admin session expired. Log out and sign in again.' : `Could not load admin settings (${response.status}).`))
  if (!result) throw new Error('The server returned an empty admin settings response.')
  return result
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-secondary px-3 py-2">
    <span className="text-lg font-semibold tabular-nums">{value}</span>
    <span className="text-[11px] text-muted-foreground">{label}</span>
  </div>
}

function hourLabel(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:00 ${suffix}`
}

type UsageResponse = { usage: { provider: string; databaseBytes: number; stationAudioBytes: number; stationAudioFiles: number; measuredAt: number } | null; unavailable?: boolean; error?: string }
type AdminRequest = { id: string; name?: string; title: string; artist: string; requestedAt: number; status: 'pending' | 'played' | 'skipped'; reason?: string }
async function usageFetcher(url: string): Promise<UsageResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  const result = await response.json().catch(() => null) as (UsageResponse & { error?: string }) | null
  if (!response.ok) throw new Error(result?.error ?? 'Could not load storage usage.')
  return result ?? { usage: null, unavailable: true }
}
async function requestsFetcher(url: string): Promise<{ requests: AdminRequest[] }> {
  const response = await fetch(url, { cache: 'no-store' })
  const result = await response.json().catch(() => null) as ({ requests: AdminRequest[]; error?: string }) | null
  if (!response.ok) throw new Error(result?.error ?? 'Could not load song requests.')
  if (!result || !Array.isArray(result.requests)) throw new Error('The server returned an invalid song requests response.')
  return { requests: result.requests }
}
function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = value / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++ }
  return `${size.toFixed(2)} ${units[unit]}`
}

function audioDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const duration = audio.duration
      URL.revokeObjectURL(url)
      Number.isFinite(duration) && duration > 0 ? resolve(duration) : reject(new Error('Could not read audio duration.'))
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This audio file could not be read by the browser.'))
    }
    audio.src = url
  })
}

export function AdminPanel() {
  const { data, error: loadError, mutate } = useSWR('/api/admin/settings', fetcher, { refreshInterval: 20000, revalidateOnFocus: true, dedupingInterval: 10000 })
  const { data: requestData, mutate: mutateRequests } = useSWR<{ requests: AdminRequest[] }>('/api/admin/requests', requestsFetcher, { refreshInterval: 10000, revalidateOnFocus: true })
  const { data: usageData, error: usageError, mutate: mutateUsage } = useSWR('/api/admin/usage', usageFetcher, { refreshInterval: 0, revalidateOnFocus: false, dedupingInterval: 300000 })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [rjMakatiScheduleStartHour, setRjMakatiScheduleStartHour] = useState('0')
  const [rjMakatiScheduleEndHour, setRjMakatiScheduleEndHour] = useState('6')
  const [signOffHour, setSignOffHour] = useState('1')
  const [signOnHour, setSignOnHour] = useState('4')
  const [discoStartHour, setDiscoStartHour] = useState('16')
  const [discoEndHour, setDiscoEndHour] = useState('19')
  const [nightVolumeStartHour, setNightVolumeStartHour] = useState('22')
  const [nightVolumeEndHour, setNightVolumeEndHour] = useState('6')
  const [listenerLimit, setListenerLimit] = useState('2')
  const [masterVolume, setMasterVolume] = useState('100')
  const [nightVolumePercent, setNightVolumePercent] = useState('72')
  const [bassGainDb, setBassGainDb] = useState('0')
  const [crossfadeSeconds, setCrossfadeSeconds] = useState('8')
  const [replayGainTargetLufs, setReplayGainTargetLufs] = useState('-14')
  const [recordingKind, setRecordingKind] = useState<'dj-mic' | null>(null)
  const [requestBusy, setRequestBusy] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!data) return
    setRjMakatiScheduleStartHour(String(data.rjMakatiScheduleStartHour))
    setRjMakatiScheduleEndHour(String(data.rjMakatiScheduleEndHour))
    setSignOffHour(String(data.signOffHour))
    setSignOnHour(String(data.signOnHour))
    setDiscoStartHour(String(data.discoStartHour))
    setDiscoEndHour(String(data.discoEndHour))
    setNightVolumeStartHour(String(data.nightVolumeStartHour))
    setNightVolumeEndHour(String(data.nightVolumeEndHour))
    setListenerLimit(String(data.listenerLimit))
    setMasterVolume(String(data.masterVolume))
    setNightVolumePercent(String(data.nightVolumePercent))
    setBassGainDb(String(data.bassGainDb))
    setCrossfadeSeconds(String(data.crossfadeSeconds))
    setReplayGainTargetLufs(String(data.replayGainTargetLufs))
  }, [data?.rjMakatiScheduleStartHour, data?.rjMakatiScheduleEndHour, data?.signOffHour, data?.signOnHour, data?.discoStartHour, data?.discoEndHour, data?.nightVolumeStartHour, data?.nightVolumeEndHour, data?.listenerLimit, data?.masterVolume, data?.nightVolumePercent, data?.bassGainDb, data?.crossfadeSeconds, data?.replayGainTargetLufs])

  const send = async (method: 'PUT' | 'POST', body?: object) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/settings', {
        method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error ?? 'Could not update settings.')
      mutate(result as AdminStatus, { revalidate: false })
      setMessage(method === 'POST'
        ? 'Rotation refreshed.'
        : result.persistenceConfigured === false
          ? 'Settings saved for this server session; they reset if the server restarts.'
          : 'Settings saved.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update settings.')
    } finally { setBusy(false) }
  }

  const updateRequest = async (id: string, status: 'played' | 'skipped' | 'pending') => {
    setRequestBusy(id)
    setError('')
    try {
      const response = await fetch('/api/admin/requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Could not update song request.')
      await mutateRequests()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update song request.')
    } finally {
      setRequestBusy(null)
    }
  }

  const upload = async (kind: 'jingle' | 'commercial' | 'golden-sunday' | 'dj-mic', file: File | undefined, slot = 0) => {
    if (!file) return
    setBusy(true); setError(''); setMessage('')
    try {
      const duration = await audioDuration(file)
      const form = new FormData()
      form.set('file', file); form.set('kind', kind); form.set('slot', String(slot)); form.set('duration', String(duration))
      const res = await fetch('/api/admin/media', { method: 'POST', body: form })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error ?? 'Audio upload failed.')
      mutate(result.status as AdminStatus, { revalidate: false })
      void mutateUsage()
      const label = kind === 'jingle' ? 'Jingle' : kind === 'dj-mic' ? 'DJ Mic' : `Commercial ${slot + 1}`
      setMessage(`${label} uploaded. A new selection replaces the previous file.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Audio upload failed.')
    } finally { setBusy(false) }
  }

  const startDjRecording = async (kind: 'dj-mic') => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser does not support microphone recording.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        recordingStreamRef.current = null
        const type = recorder.mimeType || 'audio/webm'
        void upload(kind, new File(chunks, `${kind}-${Date.now()}.webm`, { type }))
      }
      recorderRef.current = recorder
      recordingStreamRef.current = stream
      recorder.start()
      setRecordingKind(kind)
      setError('')
    } catch {
      setError('Microphone access was denied or is unavailable.')
    }
  }

  const stopDjRecording = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecordingKind(null)
  }

  return <div className="ui-depth flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
    <div className="border-b border-border pb-3">
      <h2 className="text-base font-semibold">Station Settings</h2>
      <p className="mt-1 text-xs text-muted-foreground">Control the broadcast status and what listeners see on the public player.</p>
    </div>
    {loadError && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{loadError.message}{loadError.message.toLowerCase().includes('unauthorized') || loadError.message.toLowerCase().includes('session') ? ' Log out, then sign in again.' : ''}</p>}
    {!data && !loadError && <p className="text-xs text-muted-foreground" role="status">Loading admin settings…</p>}
    {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
    {message && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300" role="status" aria-live="polite">{message}</p>}
    <section className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-3"><div><Label>Song requests</Label><p className="text-xs text-muted-foreground">Admin-only list. Hindi ito ipinapakita sa public player.</p></div><Button type="button" variant="ghost" size="sm" onClick={() => void mutateRequests()}><RefreshCw className="size-3.5" aria-hidden="true" /> Refresh</Button></div>
      {(requestData?.requests ?? []).length > 0 ? <div className="max-h-72 space-y-2 overflow-y-auto">{requestData?.requests.map((request) => <div key={request.id} className="rounded-lg border border-border/70 bg-background/45 p-2.5"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{request.title}</p><p className="truncate text-xs text-muted-foreground">{request.name || 'Listener'} · {request.artist} · {new Date(request.requestedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>{request.reason && <p className="mt-1 text-[11px] text-amber-200">{request.reason}</p>}</div><span className="shrink-0 text-[10px] font-semibold uppercase text-primary">{request.status}</span></div>{request.status === 'pending' && <div className="mt-2 flex gap-2"><Button type="button" size="sm" variant="secondary" disabled={requestBusy === request.id} onClick={() => void updateRequest(request.id, 'played')}>Played</Button><Button type="button" size="sm" variant="ghost" disabled={requestBusy === request.id} onClick={() => void updateRequest(request.id, 'skipped')}>Skip</Button></div>}</div>)}</div> : <p className="text-xs text-muted-foreground">No song requests yet.</p>}
    </section>
    <SongsPlaylistManager />
    <section className="flex flex-col gap-3 rounded-lg border border-amber-300/30 bg-amber-300/[0.06] p-3">
      <div className="flex items-center justify-between gap-3"><div><Label htmlFor="rj-makati-enabled">RJ FM MAKATI relay</Label><p className="mt-1 text-xs text-muted-foreground">ON plays the live 100.3 RJFM Makati stream. The Makati playlist is not copied or shown here. OFF returns listeners to your RJ FM queue.</p></div><Switch id="rj-makati-enabled" checked={data?.rjMakatiEnabled ?? false} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { rjMakatiEnabled: checked })} /></div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/35 p-2.5"><div><Label htmlFor="rj-makati-schedule-enabled">Auto-switch schedule</Label><p className="text-[11px] text-muted-foreground">Uses Manila time. The relay remains OFF outside this window.</p></div><Switch id="rj-makati-schedule-enabled" checked={data?.rjMakatiScheduleEnabled ?? false} disabled={!data || busy || !data?.rjMakatiEnabled} onCheckedChange={(checked) => send('PUT', { rjMakatiScheduleEnabled: checked })} /></div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium">Makati starts<select value={rjMakatiScheduleStartHour} onChange={(event) => setRjMakatiScheduleStartHour(event.target.value)} disabled={!data || busy} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring">{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs font-medium">Makati ends<select value={rjMakatiScheduleEndHour} onChange={(event) => setRjMakatiScheduleEndHour(event.target.value)} disabled={!data || busy} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring">{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label>
      </div>
      <Button variant="secondary" disabled={!data || busy || rjMakatiScheduleStartHour === rjMakatiScheduleEndHour} onClick={() => send('PUT', { rjMakatiScheduleStartHour: Number(rjMakatiScheduleStartHour), rjMakatiScheduleEndHour: Number(rjMakatiScheduleEndHour) })}>Save Makati schedule</Button>
      {rjMakatiScheduleStartHour === rjMakatiScheduleEndHour && <p className="text-xs text-destructive">Makati start and end must be different.</p>}
      <p className="text-[11px] text-muted-foreground">Source: 100.3 RJFM Makati live stream listed by Online Radio PH. Only the live relay is used; its songs are never added to your playlist.</p>
    </section>
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5"><Label htmlFor="broadcast">Broadcast</Label>
        <span className="text-xs text-muted-foreground">{data?.broadcastEnabled === false ? 'Livestream is off' : `Auto on ${hourLabel(data?.signOnHour ?? 4)} · auto off ${hourLabel(data?.signOffHour ?? 1)} · Sundays: 24/7, no sign-off`}</span></div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="destructive" size="sm" disabled={!data || busy || data.broadcastEnabled === false}
          onClick={() => send('PUT', { broadcastEnabled: false })}>Sign off now</Button>
        <Switch id="broadcast" checked={data?.broadcastEnabled ?? true} disabled={!data || busy}
          onCheckedChange={(checked) => send('PUT', { broadcastEnabled: checked })} />
      </div>
    </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label htmlFor="autodj-enabled">Automatic song rotation</Label><p className="text-xs text-muted-foreground">Leave ON for automatic searching, no-repeat rotation, and the next song after each break. OFF stops it from choosing new songs after anything already queued.</p></div>
      <Switch id="autodj-enabled" checked={data?.autoDjEnabled ?? true} disabled={!data || busy}
        onCheckedChange={(checked) => send('PUT', { autoDjEnabled: checked })} />
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-sky-300/20 bg-sky-300/[0.045] p-3">
      <div className="flex items-center justify-between gap-3">
        <div><Label htmlFor="mor-sync-enabled">RJ FM SONG SYNC</Label><p className="text-xs text-muted-foreground">ON follows song-only metadata from the configured reference stream. It looks for the same title and artist, then queues a Tagalog OPM fallback when no exact match is available. Ads, DJ talk, and news are never copied.</p></div>
        <Switch id="mor-sync-enabled" checked={data?.morSyncEnabled ?? false} disabled={!data || busy}
          onCheckedChange={(checked) => send('PUT', { morSyncEnabled: checked })} />
      </div>
      <div className="grid gap-2">
        <div className="rounded-lg border border-border/70 bg-background/55 px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">Reference Stream Now Playing</p>
          <p className="mt-0.5 truncate text-sm font-semibold">{data?.morNowPlayingTitle ?? data?.morNowPlayingRaw ?? 'Waiting for reference metadata…'}</p>
          {data?.morNowPlayingArtist && <p className="truncate text-xs text-muted-foreground">{data.morNowPlayingArtist}</p>}
        </div>
        <div className="rounded-lg border border-border/70 bg-background/55 px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">RJ FM Now Playing</p>
          <p className="mt-0.5 truncate text-sm font-semibold">{data?.moreFmNowPlaying ?? 'No track queued'}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.045] px-3 py-2">
        <div><p className="text-[11px] font-medium text-muted-foreground">RJ FM sync status</p>
          <p className={`text-sm font-bold tracking-wide ${data?.morSyncStatus === 'SYNCED' ? 'text-emerald-300' : 'text-amber-200'}`} role="status" aria-live="polite">{data?.morSyncStatus ?? 'Loading status…'}</p></div>
        {data?.morCheckedAt && <span className="text-[11px] text-muted-foreground">Checked {new Date(data.morCheckedAt).toLocaleTimeString()}</span>}
      </div>
      <p className="text-[11px] text-muted-foreground">Runs from the server cron while the admin is logged out and your computer is off. Deployment must have CRON_SECRET and a minute-level scheduler configured.</p>
    </div>

    <div className="rounded-lg border border-sky-300/20 bg-sky-300/[0.045] p-3">
      <Label>Christmas playlist rotation</Label>
      <p className="mt-1 text-xs text-muted-foreground">Automatically checks the configured YouTube Music playlist whenever a Christmas song is due, so new playlist additions need no app update or redeploy. September–October: one song after every 20 regular songs. November–December: three consecutive songs after every 20 regular songs. Rotation turns off January 1, Manila time. The 20-song interval is the default cadence because no interval was specified; the saved catalog is used if YouTube is temporarily unavailable.</p>
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label>Song rotation and listeners</Label><p className="text-xs text-muted-foreground">Songs stream from their source; the station does not save MP3 copies. The player queues just a few upcoming tracks.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/45 p-3"><div><Label htmlFor="shuffle-enabled">Shuffle: {data?.shuffleEnabled ? 'ON' : 'OFF'}</Label><p className="text-xs text-muted-foreground">ON randomizes eligible songs and artists; OFF follows source order. No-repeat protection remains active in either mode.</p></div>
          <Switch id="shuffle-enabled" aria-label="Shuffle on or off" checked={data?.shuffleEnabled ?? true} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { shuffleEnabled: checked })} /></div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300/35 bg-amber-300/[0.08] p-3"><div><Label htmlFor="board-operator-enabled">Board Operator</Label><p className="text-xs text-muted-foreground">ON displays “Board Operator Active” on the public player.</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200" role="status">{data?.boardOperatorEnabled ? 'ON · visible' : 'OFF · hidden'}</p></div>
          <Switch id="board-operator-enabled" aria-label="Board Operator on or off" checked={data?.boardOperatorEnabled ?? false} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { boardOperatorEnabled: checked })} /></div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <label htmlFor="listener-limit" className="flex flex-col gap-1 text-xs font-medium">Listener cap (0 = unlimited)
          <Input id="listener-limit" type="number" min={0} max={1000} step={1} value={listenerLimit} onChange={(event) => setListenerLimit(event.target.value)} disabled={!data || busy} />
        </label>
      </div>
      <Button variant="secondary" disabled={!data || busy || Number(listenerLimit) < 0 || Number(listenerLimit) > 1000 || !Number.isInteger(Number(listenerLimit))}
        onClick={() => send('PUT', { listenerLimit: Number(listenerLimit) })}>Save listener limit</Button>
      <p className="text-xs text-muted-foreground">When the cap is reached, new listeners see “THIS STATION HAS REACHED ITS LISTENER LIMIT.” Existing listeners stay connected. The default cap is 2; set it to 0 for unlimited.</p>
      <div className="flex flex-col gap-3 rounded-lg border border-sky-300/20 bg-sky-300/[0.045] p-3">
        <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-sky-300" aria-hidden="true" /><div><Label>Listener Monitor</Label><p className="text-xs text-muted-foreground">Basic active-listener count and capacity only. No location data is collected.</p></div></div><Button type="button" variant="ghost" size="sm" disabled={!data || busy} onClick={() => void mutate()}><RefreshCw className="size-3.5" aria-hidden="true" /> Refresh</Button></div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Total active listeners" value={data?.listenersNow ?? '–'} />
          <Stat label="Listener limit" value={data?.listenerLimit ? data.listenerLimit : 'Unlimited'} />
        </div>
        <p className="text-[11px] text-muted-foreground">Shows unique active player tabs; sessions expire after 60 seconds without a heartbeat. No location data is collected.</p>
        {data?.listenerLimit && data.listenerCapGloballyEnforced === false && <p className="text-[11px] text-amber-200">This storage-only listener cap is best-effort across simultaneously running app instances. Configure PostgreSQL for a race-free global cap.</p>}
      </div>
    </div>

    <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label htmlFor="tagalog-only-enabled">Tagalog-only love-song mode</Label><p className="text-xs text-muted-foreground">Default ON: randomly rotates Tagalog OPM love songs and blocks titles already played that Manila day. English tracks are skipped while this mode is ON. The current song finishes; upcoming tracks are refreshed.</p></div>
        <Switch id="tagalog-only-enabled" checked={data?.tagalogOnlyEnabled ?? true} disabled={!data || busy}
        onCheckedChange={(checked) => send('PUT', { tagalogOnlyEnabled: checked })} />
    </div>

    <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label htmlFor="good-vibes-enabled">Good Vibes mode</Label><p className="text-xs text-muted-foreground">ON gives priority to beautiful English pop and feel-good hits from artists like Ava Max, Dua Lipa, Sia, Katy Perry, and more. Turning it ON refreshes upcoming tracks.</p></div>
      <Switch id="good-vibes-enabled" checked={data?.goodVibesEnabled ?? false} disabled={!data || busy}
        onCheckedChange={(checked) => send('PUT', { goodVibesEnabled: checked })} />
    </div>

    <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label htmlFor="transmitter-watts">Transmitter power profile</Label><p className="text-xs text-muted-foreground">Choose a profile label only. It will not add static, change song volume, affect real transmitter output, or change actual internet coverage.</p></div>
      <select id="transmitter-watts" value={data?.transmitterWatts ?? 100000} disabled={!data || busy}
        onChange={(event) => send('PUT', { transmitterWatts: Number(event.target.value) })}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
        <option value={0}>0 watts — no-transmitter profile</option>
        <option value={5000}>5,000 watts — Naga City/local profile</option>
        <option value={20000}>20,000 watts — medium-power profile</option>
        <option value={100000}>100,000 watts — wider-coverage profile</option>
      </select>
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-3"><div><Label htmlFor="news-enabled">4:00–4:50 PM news block</Label><p className="text-xs text-muted-foreground">Pause Disco during the news window; regular music plays if no bulletin is configured.</p></div>
        <Switch id="news-enabled" checked={data?.newsEnabled ?? true} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { newsEnabled: checked })} /></div>
      <div className="flex items-center justify-between gap-3"><div><Label htmlFor="dj-mic-enabled">DJ Mic</Label><p className="text-xs text-muted-foreground">Play a recorded microphone announcement to every listener after the current track.</p></div>
        <Switch id="dj-mic-enabled" checked={data?.djMicEnabled ?? false} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { djMicEnabled: checked })} /></div>
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label>YouTube playlist rotation</Label><p className="text-xs text-muted-foreground">Playlist contents refresh automatically. Saturday and Sunday use Golden Sunday; weekdays use Afternoon plus the DITO playlist.</p></div>
      <div className="grid gap-1 text-xs">
        <a className="truncate text-primary underline" href="https://music.youtube.com/playlist?list=PLd469-e1TkbM" target="_blank" rel="noreferrer">DITO / RJ FM — editable playlist</a>
        <a className="truncate text-primary underline" href="https://music.youtube.com/playlist?list=PLZxu4AZwv5H0" target="_blank" rel="noreferrer">Saturday–Sunday — Golden Sunday</a>
        <a className="truncate text-primary underline" href="https://music.youtube.com/playlist?list=PLWrP0D7Qkd-M" target="_blank" rel="noreferrer">Weekdays — Afternoon / daily playlist</a>
      </div>
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start gap-2"><Clock3 className="mt-0.5 size-4 text-primary" aria-hidden="true" /><div><Label>Broadcast schedule</Label><p className="text-xs text-muted-foreground">Choose the regular schedule in Manila time. Sunday broadcasts continuously with no sign-off.</p></div></div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium">Sign off
          <select value={signOffHour} onChange={(event) => setSignOffHour(event.target.value)} disabled={!data || busy} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring">
            {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">Sign on
          <select value={signOnHour} onChange={(event) => setSignOnHour(event.target.value)} disabled={!data || busy} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring">
            {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
          </select>
        </label>
      </div>
      <Button variant="secondary" disabled={!data || busy || signOffHour === signOnHour} onClick={() => send('PUT', { signOffHour: Number(signOffHour), signOnHour: Number(signOnHour) })}>Save schedule</Button>
      {signOffHour === signOnHour && <p className="text-xs text-destructive">Sign-off and sign-on must be different.</p>}
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label>Weekday afternoon and evening schedule</Label><p className="text-xs text-muted-foreground">Disco runs through 6:59 PM, then RJ FM switches at 7:00 PM, 9:00 PM, 10:00 PM, and midnight, Manila time.</p></div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium">Disco start
          <select value={discoStartHour} onChange={(event) => setDiscoStartHour(event.target.value)} disabled={!data || busy} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring">{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">Disco end
          <select value={discoEndHour} onChange={(event) => setDiscoEndHour(event.target.value)} disabled={!data || busy} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring">{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select>
        </label>
      </div>
      <Button variant="secondary" disabled={!data || busy || discoStartHour === discoEndHour} onClick={() => send('PUT', { discoStartHour: Number(discoStartHour), discoEndHour: Number(discoEndHour) })}>Save afternoon schedule</Button>
      {discoStartHour === discoEndHour && <p className="text-xs text-destructive">Disco start and end must be different.</p>}
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3"><div><Label htmlFor="night-volume-enabled">Night volume</Label><p className="text-xs text-muted-foreground">Lower the full broadcast mix during late hours, then return to normal automatically.</p></div>
        <Switch id="night-volume-enabled" checked={data?.nightVolumeEnabled ?? false} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { nightVolumeEnabled: checked })} /></div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium">Night starts
          <select value={nightVolumeStartHour} onChange={(event) => setNightVolumeStartHour(event.target.value)} disabled={!data || busy} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring">{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">Night ends
          <select value={nightVolumeEndHour} onChange={(event) => setNightVolumeEndHour(event.target.value)} disabled={!data || busy} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring">{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select>
        </label>
      </div>
      <Button variant="secondary" disabled={!data || busy || nightVolumeStartHour === nightVolumeEndHour} onClick={() => send('PUT', { nightVolumeStartHour: Number(nightVolumeStartHour), nightVolumeEndHour: Number(nightVolumeEndHour) })}>Save night hours</Button>
      {nightVolumeStartHour === nightVolumeEndHour && <p className="text-xs text-destructive">Night-volume start and end must be different.</p>}
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label>Advanced audio controls</Label><p className="text-xs text-muted-foreground">Master volume stays normal outside the night schedule. The next song is preloaded muted; Constant Power is the default so the old song fades down as the new one rises without a midpoint volume dip.</p></div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium">Master volume (%)<Input type="number" min={0} max={100} step={1} value={masterVolume} onChange={(event) => setMasterVolume(event.target.value)} disabled={!data || busy} /></label>
        <label className="flex flex-col gap-1 text-xs font-medium">Night volume (%)<Input type="number" min={0} max={100} step={1} value={nightVolumePercent} onChange={(event) => setNightVolumePercent(event.target.value)} disabled={!data || busy} /></label>
        <label className="flex flex-col gap-1 text-xs font-medium">Bass gain (dB)<Input type="number" min={-12} max={12} step={0.5} value={bassGainDb} onChange={(event) => setBassGainDb(event.target.value)} disabled={!data || busy} /></label>
        <label className="flex flex-col gap-1 text-xs font-medium">Crossfade (0–30 sec)<Input type="number" min={0} max={30} step={0.1} value={crossfadeSeconds} onChange={(event) => setCrossfadeSeconds(event.target.value)} disabled={!data || busy} /></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium">Crossfader curve
          <select value={data?.crossfaderCurve ?? 'constant-power'} disabled={!data || busy} onChange={(event) => send('PUT', { crossfaderCurve: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring">
            <option value="transition">Transition</option><option value="smooth">Smooth</option><option value="constant-power">Constant Power</option><option value="dipped">Dipped</option><option value="slow-fade">Slow Fade</option><option value="slow-cut">Slow Cut</option><option value="fast-fade">Fast Fade</option><option value="fast-cut">Fast Cut</option><option value="full-cut">Full Cut</option><option value="scratch-cut">Scratch Cut</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">Replay Gain target (LUFS)<Input type="number" min={-24} max={-5} step={0.5} value={replayGainTargetLufs} onChange={(event) => setReplayGainTargetLufs(event.target.value)} disabled={!data || busy} /></label>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2"><Switch id="crossfader-enabled" checked={data?.crossfaderEnabled ?? true} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { crossfaderEnabled: checked })} /><Label htmlFor="crossfader-enabled">Crossfader ON</Label></div>
        <div className="flex items-center gap-2"><Switch id="replay-gain-enabled" checked={data?.replayGainEnabled ?? false} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { replayGainEnabled: checked })} /><Label htmlFor="replay-gain-enabled">Replay Gain ON</Label></div>
      </div>
      <Button variant="secondary" disabled={!data || busy || Number(masterVolume) < 0 || Number(masterVolume) > 100 || Number(nightVolumePercent) < 0 || Number(nightVolumePercent) > 100 || Number(bassGainDb) < -12 || Number(bassGainDb) > 12 || Number(crossfadeSeconds) < 0 || Number(crossfadeSeconds) > 30 || Number(replayGainTargetLufs) < -24 || Number(replayGainTargetLufs) > -5} onClick={() => send('PUT', { masterVolume: Number(masterVolume), nightVolumePercent: Number(nightVolumePercent), bassGainDb: Number(bassGainDb), crossfadeSeconds: Number(crossfadeSeconds), replayGainTargetLufs: Number(replayGainTargetLufs) })}>Save audio controls</Button>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <Stat label="Total listeners now" value={data?.listenersNow ?? '–'} />
      <Stat label="Queued tracks" value={data?.queued ?? '–'} />
      <Stat label="Heart ratings" value={data?.totalRatings ?? '–'} />
    </div>
    <p className="-mt-2 text-[11px] text-muted-foreground">Estimated browsers currently playing; inactive sessions expire after one minute.</p>
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2"><Database className="size-4 text-primary" aria-hidden="true" /><div><h3 className="text-sm font-semibold">Live storage usage</h3><p className="text-xs text-muted-foreground">{usageData?.usage?.provider ?? 'Optional monitor'}</p></div></div>
      {usageError ? <p className="text-xs text-muted-foreground">Storage usage unavailable. Station controls remain available.</p> : usageData?.usage ? <div className="grid grid-cols-2 gap-2">
        <Stat label="Supabase database" value={formatBytes(usageData.usage.databaseBytes)} />
        <Stat label="Station audio files" value={`${formatBytes(usageData.usage.stationAudioBytes)} · ${usageData.usage.stationAudioFiles} files`} />
      </div> : <p className="text-xs text-muted-foreground">Storage usage unavailable. Station controls remain available.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-muted-foreground">Database size is reported by PostgreSQL; audio totals use stored object file sizes in this app’s Supabase Storage bucket. This is app storage, not total Render bandwidth, build, or function quota.</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => void mutateUsage()}><RefreshCw className="size-3.5" aria-hidden="true" /> Refresh usage</Button></div>
    </div>
    <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex items-center gap-2"><Database className="size-4 text-emerald-400" aria-hidden="true" /><div><h3 className="text-sm font-semibold">Storage Protection</h3><p className="text-xs text-muted-foreground">Enabled automatically to help avoid unnecessary storage upgrades.</p></div></div>
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Identical audio uploads reuse the same stored file instead of creating duplicates.</li>
        <li>Replacing a jingle, commercial, DJ Mic, or voice clip removes the old stored copy.</li>
        <li>Audio uploads are limited to 4 MB per file, and the station keeps only a short upcoming playback queue.</li>
      </ul>
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label>Shared DJ Mic</Label><p className="text-xs text-muted-foreground">Record a microphone clip. It is queued after the current track on regular days; Sunday’s golden jingle schedule remains separate, so mic clips are not played then.</p></div>
      <div className="flex flex-wrap gap-2">
        {recordingKind !== 'dj-mic' ? <Button type="button" variant="secondary" disabled={!data?.djMicEnabled || busy || recordingKind !== null} onClick={() => void startDjRecording('dj-mic')}><Mic2 aria-hidden="true" /> Record DJ Mic</Button> : <Button type="button" variant="destructive" onClick={stopDjRecording}><Square aria-hidden="true" /> Stop recording</Button>}
        {!data?.djMicEnabled && <span className="self-center text-xs text-muted-foreground">Turn on DJ Mic above first.</span>}
      </div>
      {data?.djMic && <p className="truncate text-xs text-muted-foreground">Last clip: {data.djMic.name}</p>}
    </div>

    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
      <Label>Music-only rotation</Label>
      <p className="mt-1 text-xs text-muted-foreground">Jingles, commercials, and station break spots have been removed. The station continues directly to the next no-repeat song.</p>
    </div>
    <Button variant="secondary" disabled={busy} onClick={() => send('POST')}>
      <RefreshCw className={busy ? 'animate-spin' : undefined} aria-hidden="true" /> Refresh rotation
    </Button>
    <p className="text-xs leading-relaxed text-muted-foreground">The station keeps the configured sign-on/sign-off schedule and listener limit while rotating songs continuously without jingle or commercial breaks.</p>
  </div>
}
