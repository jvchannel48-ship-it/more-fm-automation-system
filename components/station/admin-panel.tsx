'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Clock3, Database, MapPin, Mic2, RefreshCw, Square, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { AdminStatus } from '@/lib/types'

// Keep the admin rotation-history control aligned with the server's 50–300 song range.
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
async function usageFetcher(url: string): Promise<UsageResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  const result = await response.json().catch(() => null) as (UsageResponse & { error?: string }) | null
  if (!response.ok) throw new Error(result?.error ?? 'Could not load storage usage.')
  return result ?? { usage: null, unavailable: true }
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
  const { data: usageData, error: usageError, mutate: mutateUsage } = useSWR('/api/admin/usage', usageFetcher, { refreshInterval: 0, revalidateOnFocus: false, dedupingInterval: 300000 })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [signOffHour, setSignOffHour] = useState('1')
  const [signOnHour, setSignOnHour] = useState('4')
  const [discoStartHour, setDiscoStartHour] = useState('16')
  const [discoEndHour, setDiscoEndHour] = useState('19')
  const [nightVolumeStartHour, setNightVolumeStartHour] = useState('22')
  const [nightVolumeEndHour, setNightVolumeEndHour] = useState('6')
  const [rotationPoolSize, setRotationPoolSize] = useState('100')
  const [listenerLimit, setListenerLimit] = useState('0')
  const [masterVolume, setMasterVolume] = useState('100')
  const [nightVolumePercent, setNightVolumePercent] = useState('72')
  const [bassGainDb, setBassGainDb] = useState('0')
  const [crossfadeSeconds, setCrossfadeSeconds] = useState('8')
  const [replayGainTargetLufs, setReplayGainTargetLufs] = useState('-14')
  const [recordingKind, setRecordingKind] = useState<'dj-mic' | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!data) return
    setSignOffHour(String(data.signOffHour))
    setSignOnHour(String(data.signOnHour))
    setDiscoStartHour(String(data.discoStartHour))
    setDiscoEndHour(String(data.discoEndHour))
    setNightVolumeStartHour(String(data.nightVolumeStartHour))
    setNightVolumeEndHour(String(data.nightVolumeEndHour))
    setRotationPoolSize(String(data.rotationPoolSize))
    setListenerLimit(String(data.listenerLimit))
    setMasterVolume(String(data.masterVolume))
    setNightVolumePercent(String(data.nightVolumePercent))
    setBassGainDb(String(data.bassGainDb))
    setCrossfadeSeconds(String(data.crossfadeSeconds))
    setReplayGainTargetLufs(String(data.replayGainTargetLufs))
  }, [data?.signOffHour, data?.signOnHour, data?.discoStartHour, data?.discoEndHour, data?.nightVolumeStartHour, data?.nightVolumeEndHour, data?.rotationPoolSize, data?.listenerLimit, data?.masterVolume, data?.nightVolumePercent, data?.bassGainDb, data?.crossfadeSeconds, data?.replayGainTargetLufs])

  const send = async (method: 'PUT' | 'POST', body?: object) => {
    if (data?.persistenceConfigured === false) {
      setError('Cannot save admin settings: configure POSTGRES_URL or Supabase Storage credentials (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY), then redeploy.')
      setMessage('')
      return
    }
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
      setMessage(method === 'POST' ? 'Rotation refreshed.' : 'Settings saved.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update settings.')
    } finally { setBusy(false) }
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
    {data?.persistenceConfigured === false && <p className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100" role="alert">Admin changes need PostgreSQL or private Supabase Storage. Configure <code>POSTGRES_URL</code>, or <code>SUPABASE_URL</code> and server-only <code>SUPABASE_SERVICE_ROLE_KEY</code>, then redeploy; see <code>docs/deployment-env.md</code>.</p>}
    {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
    {message && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300" role="status" aria-live="polite">{message}</p>}
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5"><Label htmlFor="broadcast">Broadcast</Label>
        <span className="text-xs text-muted-foreground">{data?.broadcastEnabled === false ? 'Livestream is off' : `Auto on ${hourLabel(data?.signOnHour ?? 4)} · auto off ${hourLabel(data?.signOffHour ?? 1)} · Sundays: 24/7, no sign-off`}</span></div>
      <Switch id="broadcast" checked={data?.broadcastEnabled ?? true} disabled={!data || busy}
        onCheckedChange={(checked) => send('PUT', { broadcastEnabled: checked })} />
    </div>

    <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label htmlFor="autodj-enabled">AutoDJ</Label><p className="text-xs text-muted-foreground">Leave ON when no host is available or you are busy. AutoDJ avoids repeats within the configured 50–300-song rotation history. OFF stops it from choosing new songs after anything already queued.</p></div>
      <Switch id="autodj-enabled" checked={data?.autoDjEnabled ?? true} disabled={!data || busy}
        onCheckedChange={(checked) => send('PUT', { autoDjEnabled: checked })} />
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-sky-300/20 bg-sky-300/[0.045] p-3">
      <div className="flex items-center justify-between gap-3">
        <div><Label htmlFor="mor-sync-enabled">MOR SYNC MODE</Label><p className="text-xs text-muted-foreground">ON follows song-only MOR Manila stream metadata. It looks for the same title and artist, then queues a Tagalog OPM fallback when no exact match is available. Ads, DJ talk, and news are never copied.</p></div>
        <Switch id="mor-sync-enabled" checked={data?.morSyncEnabled ?? false} disabled={!data || busy}
          onCheckedChange={(checked) => send('PUT', { morSyncEnabled: checked })} />
      </div>
      <div className="grid gap-2">
        <div className="rounded-lg border border-border/70 bg-background/55 px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">MOR Manila Now Playing</p>
          <p className="mt-0.5 truncate text-sm font-semibold">{data?.morNowPlayingTitle ?? data?.morNowPlayingRaw ?? 'Waiting for MOR metadata…'}</p>
          {data?.morNowPlayingArtist && <p className="truncate text-xs text-muted-foreground">{data.morNowPlayingArtist}</p>}
        </div>
        <div className="rounded-lg border border-border/70 bg-background/55 px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">MoRe FM Now Playing</p>
          <p className="mt-0.5 truncate text-sm font-semibold">{data?.moreFmNowPlaying ?? 'No track queued'}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.045] px-3 py-2">
        <div><p className="text-[11px] font-medium text-muted-foreground">MOR sync status</p>
          <p className={`text-sm font-bold tracking-wide ${data?.morSyncStatus === 'SYNCED' ? 'text-emerald-300' : 'text-amber-200'}`} role="status" aria-live="polite">{data?.morSyncStatus ?? 'Loading status…'}</p></div>
        {data?.morCheckedAt && <span className="text-[11px] text-muted-foreground">Checked {new Date(data.morCheckedAt).toLocaleTimeString()}</span>}
      </div>
      <p className="text-[11px] text-muted-foreground">Runs from the server cron while the admin is logged out and your computer is off. Deployment must have CRON_SECRET and a minute-level scheduler configured.</p>
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label>Song rotation and listeners</Label><p className="text-xs text-muted-foreground">Songs stream from their source; the station does not save MP3 copies. Only recent song identifiers are kept for repeat avoidance, and the player queues just a few upcoming tracks.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/45 p-3"><div><Label htmlFor="shuffle-enabled">Shuffle: OFF</Label><p className="text-xs text-muted-foreground">Fixed OFF so the eligible catalog follows source order and the no-repeat ledger can work through every song.</p></div>
          <Switch id="shuffle-enabled" checked={false} disabled /></div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300/35 bg-amber-300/[0.08] p-3"><div><Label htmlFor="board-operator-enabled">Board Operator</Label><p className="text-xs text-muted-foreground">ON displays “Board Operator Active” on the public player.</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200" role="status">{data?.boardOperatorEnabled ? 'ON · visible' : 'OFF · hidden'}</p></div>
          <Switch id="board-operator-enabled" aria-label="Board Operator on or off" checked={data?.boardOperatorEnabled ?? false} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { boardOperatorEnabled: checked })} /></div>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300/30 bg-emerald-300/[0.07] p-3">
        <div><Label htmlFor="no-repeat-enabled">{data?.noRepeatEnabled ? 'No Repeat: ON' : 'No Repeat: OFF'}</Label><p className="text-xs text-muted-foreground">Blocks normalized song titles across artists and common version labels for the Manila day. It resets tomorrow; provider metadata can still vary for unusual alternate recordings.</p></div>
        <Switch id="no-repeat-enabled" aria-label="No Repeat on or off" checked={data?.noRepeatEnabled ?? true} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { noRepeatEnabled: checked })} />
      </div>
      <div className="rounded-lg border border-emerald-300/20 bg-background/45 p-3">
        <div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold">Played today · {data?.dailyPlayedDate ?? '—'}</p><p className="text-[11px] text-muted-foreground">Finished tracks leave the short playback queue and are logged here. Songs are discovered on demand; no local music files are deleted.</p></div><span className="font-mono text-xs text-emerald-200">{data?.dailyPlayedTitles?.length ?? 0} titles</span></div>
        {(data?.dailyPlayedTitles ?? []).length > 0 ? <div className="max-h-48 space-y-1 overflow-y-auto">{data?.dailyPlayedTitles.map((song) => <div key={`${song.playedAt}-${song.title}`} className="flex items-center justify-between gap-3 rounded border border-border/60 px-2 py-1.5 text-xs"><span className="truncate">{song.title}</span><span className="shrink-0 text-muted-foreground">{song.artist} · {new Date(song.playedAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })}</span></div>)}</div> : <p className="text-xs text-muted-foreground">No songs completed today yet.</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor="rotation-pool-size" className="flex flex-col gap-1 text-xs font-medium">Rotation history size (50–300 songs)
          <Input id="rotation-pool-size" type="number" min={50} max={300} step={1} value={rotationPoolSize} onChange={(event) => setRotationPoolSize(event.target.value)} disabled={!data || busy} />
        </label>
        <label htmlFor="listener-limit" className="flex flex-col gap-1 text-xs font-medium">Listener cap (0 = unlimited)
          <Input id="listener-limit" type="number" min={0} max={1000} step={1} value={listenerLimit} onChange={(event) => setListenerLimit(event.target.value)} disabled={!data || busy} />
        </label>
      </div>
      <Button variant="secondary" disabled={!data || busy || Number(rotationPoolSize) < 50 || Number(rotationPoolSize) > 300 || Number(listenerLimit) < 0 || Number(listenerLimit) > 1000 || !Number.isInteger(Number(rotationPoolSize)) || !Number.isInteger(Number(listenerLimit))}
        onClick={() => send('PUT', { rotationPoolSize: Number(rotationPoolSize), listenerLimit: Number(listenerLimit) })}>Save rotation and listener limits</Button>
      <p className="text-xs text-muted-foreground">When the cap is reached, new listeners see “THIS STATION IS LIMITED LISTENER. Please try again later.” Existing listeners stay connected. Listener cap defaults to unlimited.</p>
      <div className="flex flex-col gap-3 rounded-lg border border-sky-300/20 bg-sky-300/[0.045] p-3">
        <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-sky-300" aria-hidden="true" /><div><Label>Listener Monitor</Label><p className="text-xs text-muted-foreground">Basic active-listener count and capacity only. No location data is collected.</p></div></div><Button type="button" variant="ghost" size="sm" disabled={!data || busy} onClick={() => void mutate()}><RefreshCw className="size-3.5" aria-hidden="true" /> Refresh</Button></div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Active listeners" value={data?.listenersNow ?? '–'} />
          <Stat label="Listener limit" value={data?.listenerLimit ? data.listenerLimit : 'Unlimited'} />
        </div>
        <p className="text-[11px] text-muted-foreground">Listener sessions expire after 60 seconds without a heartbeat. No location data is collected.</p>
      </div>
    </div>

    <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label htmlFor="tagalog-only-enabled">Tagalog-only love-song mode</Label><p className="text-xs text-muted-foreground">Default ON: randomly rotates Tagalog OPM love songs and blocks titles already played that Manila day. English MOR matches are skipped while this mode is ON. The current song finishes; upcoming tracks are refreshed.</p></div>
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
      <div><Label>Advanced audio controls</Label><p className="text-xs text-muted-foreground">Master volume stays normal outside the night schedule. Night volume applies only during the configured night hours.</p></div>
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
      <Stat label="Listeners now" value={data?.listenersNow ?? '–'} />
      <Stat label="Songs in history" value={data?.songsThisWeek ?? '–'} />
      <Stat label="Artists / hour" value={data?.artistsThisHour ?? '–'} />
      <Stat label="Queued tracks" value={data?.queued ?? '–'} />
      <Stat label="Heart ratings" value={data?.totalRatings ?? '–'} />
    </div>
    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label>Playback statistics</Label><p className="text-xs text-muted-foreground">Based on songs successfully added to station history.</p></div>
      <div className="grid grid-cols-2 gap-2"><Stat label="Plays / last 24 hours" value={data?.playbackStats?.last24Hours ?? '–'} /><Stat label="Plays / last 7 days" value={data?.playbackStats?.last7Days ?? '–'} /></div>
      <div className="grid gap-1 text-xs">{data?.playbackStats?.topArtists?.slice(0, 5).map((item) => <div key={item.artist} className="flex justify-between gap-3"><span className="truncate">{item.artist}</span><span className="font-mono text-muted-foreground">{item.plays}</span></div>)}</div>
      <div className="border-t border-border pt-2 text-xs">{data?.playbackStats?.recentSongs?.slice(0, 5).map((song) => <div key={`${song.playedAt}-${song.title}`} className="flex justify-between gap-3 py-1"><span className="truncate">{song.title}</span><span className="shrink-0 text-muted-foreground">{song.artist}</span></div>)}</div>
    </div>
    <p className="-mt-2 text-[11px] text-muted-foreground">Estimated browsers currently playing; inactive sessions expire after one minute.</p>
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2"><Database className="size-4 text-primary" aria-hidden="true" /><div><h3 className="text-sm font-semibold">Live storage usage</h3><p className="text-xs text-muted-foreground">{usageData?.usage?.provider ?? 'Optional monitor'}</p></div></div>
      {usageError ? <p className="text-xs text-muted-foreground">Storage usage unavailable. Station controls remain available.</p> : usageData?.usage ? <div className="grid grid-cols-2 gap-2">
        <Stat label="Supabase database" value={formatBytes(usageData.usage.databaseBytes)} />
        <Stat label="Station audio files" value={`${formatBytes(usageData.usage.stationAudioBytes)} · ${usageData.usage.stationAudioFiles} files`} />
      </div> : <p className="text-xs text-muted-foreground">Storage usage unavailable. Station controls remain available.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-muted-foreground">Database size is reported by PostgreSQL; audio totals use stored object file sizes in this app’s Supabase Storage bucket. This is app storage, not total Vercel bandwidth, build, or function quota.</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => void mutateUsage()}><RefreshCw className="size-3.5" aria-hidden="true" /> Refresh usage</Button></div>
    </div>
    <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex items-center gap-2"><Database className="size-4 text-emerald-400" aria-hidden="true" /><div><h3 className="text-sm font-semibold">Storage Protection</h3><p className="text-xs text-muted-foreground">Enabled automatically to help avoid unnecessary storage upgrades.</p></div></div>
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Identical audio uploads reuse the same stored file instead of creating duplicates.</li>
        <li>Replacing a jingle, commercial, DJ Mic, or voice clip removes the old stored copy.</li>
        <li>Audio uploads are limited to 4 MB per file, and song rotation keeps only recent history.</li>
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

      <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3"><div><Label htmlFor="jingle-enabled">Jingle</Label><p className="text-xs text-muted-foreground">On regular days, the station jingle plays automatically after every 4 songs, then the next music track starts. Sunday uses the golden jingle after every 5 songs from 6:00 AM; songs stay continuous from midnight until morning. MP3 supported · max 4 MB.</p></div>
        <Switch id="jingle-enabled" checked={data?.jingleEnabled ?? false} disabled={!data || busy}
          onCheckedChange={(checked) => send('PUT', { jingleEnabled: checked })} /></div>
      <label htmlFor="upload-jingle" className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-secondary ${busy ? 'pointer-events-none opacity-50' : ''}`}>
        <Upload className="size-4" aria-hidden="true" /> {data?.jingle ? 'Replace jingle audio' : 'Upload jingle audio'}</label>
      <input id="upload-jingle" type="file" accept=".mp3,audio/mpeg,audio/mp3,audio/*" className="sr-only" disabled={busy}
        onChange={(event) => { void upload('jingle', event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
      {data?.jingle && <a href={data.jingle.url} target="_blank" rel="noreferrer" className="truncate text-xs text-primary underline">Current: {data.jingle.name}</a>}
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3"><div><Label htmlFor="commercial-enabled">Commercials</Label><p className="text-xs text-muted-foreground">Play saved slots after the jingle only when Jingle is ON; commercials are suppressed all day Sunday. MP3 supported · max 4 MB per file.</p></div>
        <Switch id="commercial-enabled" checked={data?.commercialEnabled ?? false} disabled={!data || busy}
          onCheckedChange={(checked) => send('PUT', { commercialEnabled: checked })} /></div>
      {[0, 1, 2].map((slot) => {
        const asset = data?.commercials?.[slot]
        return <div key={slot} className="flex flex-col gap-1 border-t border-border pt-2">
          <label htmlFor={`upload-commercial-${slot}`} className={`flex cursor-pointer items-center gap-2 text-sm hover:text-primary ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            <Upload className="size-3.5" aria-hidden="true" /> {asset ? `Replace commercial ${slot + 1}` : `Upload commercial ${slot + 1}`}</label>
          <input id={`upload-commercial-${slot}`} type="file" accept=".mp3,audio/mpeg,audio/mp3,audio/*" className="sr-only" disabled={busy}
            onChange={(event) => { void upload('commercial', event.currentTarget.files?.[0], slot); event.currentTarget.value = '' }} />
          {asset && <a href={asset.url} target="_blank" rel="noreferrer" className="truncate text-xs text-primary underline">{asset.name}</a>}
        </div>
      })}
    </div>
    <Button variant="secondary" disabled={busy} onClick={() => send('POST')}>
      <RefreshCw className={busy ? 'animate-spin' : undefined} aria-hidden="true" /> Refresh rotation
    </Button>
    <p className="text-xs leading-relaxed text-muted-foreground">Every Sunday, Tagalog senior classics play continuously all day with no English songs, commercials, or news. From 6:00 AM, the Sunday golden jingle plays after every five songs; from 12:00 AM until morning, songs remain continuous. On other days, the RJ FM jingle plays after every four songs before the next music track.</p>
  </div>
}
