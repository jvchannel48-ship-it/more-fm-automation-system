'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Clock3, Mic2, RefreshCw, Square, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { AdminStatus } from '@/lib/types'
import { RequestInbox } from './request-inbox'

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error('Unauthorized')
  return r.json() as Promise<AdminStatus>
})

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
  const { data, mutate } = useSWR('/api/admin/settings', fetcher, { refreshInterval: 15000 })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [signOffHour, setSignOffHour] = useState('1')
  const [signOnHour, setSignOnHour] = useState('4')
  const [discoStartHour, setDiscoStartHour] = useState('16')
  const [discoEndHour, setDiscoEndHour] = useState('20')
  const [nightVolumeStartHour, setNightVolumeStartHour] = useState('22')
  const [nightVolumeEndHour, setNightVolumeEndHour] = useState('6')
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!data) return
    setSignOffHour(String(data.signOffHour))
    setSignOnHour(String(data.signOnHour))
    setDiscoStartHour(String(data.discoStartHour))
    setDiscoEndHour(String(data.discoEndHour))
    setNightVolumeStartHour(String(data.nightVolumeStartHour))
    setNightVolumeEndHour(String(data.nightVolumeEndHour))
  }, [data?.signOffHour, data?.signOnHour, data?.discoStartHour, data?.discoEndHour, data?.nightVolumeStartHour, data?.nightVolumeEndHour])

  const send = async (method: 'PUT' | 'POST', body?: object) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/settings', {
        method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Could not update settings.')
      mutate(result as AdminStatus, { revalidate: false })
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
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Audio upload failed.')
      mutate(result.status as AdminStatus, { revalidate: false })
      const label = kind === 'golden-sunday' ? 'Golden Sunday' : kind === 'jingle' ? 'Jingle' : kind === 'dj-mic' ? 'DJ Mic' : `Commercial ${slot + 1}`
      setMessage(`${label} uploaded. A new selection replaces the previous file.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Audio upload failed.')
    } finally { setBusy(false) }
  }

  const startDjRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser does not support microphone recording.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      const context = AudioContextClass ? new AudioContextClass() : null
      if (context) await context.resume()
      const processedStream = context ? (() => {
        const source = context.createMediaStreamSource(stream)
        const compressor = context.createDynamicsCompressor()
        compressor.threshold.value = -24
        compressor.knee.value = 18
        compressor.ratio.value = 4
        compressor.attack.value = 0.003
        compressor.release.value = 0.25
        const gain = context.createGain()
        gain.gain.value = 1.08
        const destination = context.createMediaStreamDestination()
        source.connect(compressor)
        compressor.connect(gain)
        gain.connect(destination)
        return destination.stream
      })() : stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
      const recorder = new MediaRecorder(processedStream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        void context?.close()
        recordingContextRef.current = null
        recordingStreamRef.current = null
        const type = recorder.mimeType || 'audio/webm'
        void upload('dj-mic', new File(chunks, `dj-mic-${Date.now()}.webm`, { type }))
      }
      recorderRef.current = recorder
      recordingStreamRef.current = stream
      recordingContextRef.current = context
      recorder.start()
      setRecording(true)
      setError('')
    } catch {
      setError('Microphone access was denied or is unavailable.')
    }
  }

  const stopDjRecording = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  return <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5"><Label htmlFor="broadcast">Broadcast</Label>
        <span className="text-xs text-muted-foreground">{data?.broadcastEnabled === false ? 'Livestream is off' : `Auto on ${hourLabel(data?.signOnHour ?? 4)} · auto off ${hourLabel(data?.signOffHour ?? 1)}`}</span></div>
      <Switch id="broadcast" checked={data?.broadcastEnabled ?? true} disabled={!data || busy}
        onCheckedChange={(checked) => send('PUT', { broadcastEnabled: checked })} />
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-3"><div><Label htmlFor="christmas-enabled">Christmas music</Label><p className="text-xs text-muted-foreground">Include seasonal Christmas songs in the automated rotation.</p></div>
        <Switch id="christmas-enabled" checked={data?.christmasEnabled ?? true} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { christmasEnabled: checked })} /></div>
      <div className="flex items-center justify-between gap-3"><div><Label htmlFor="news-enabled">4:00–4:50 PM news block</Label><p className="text-xs text-muted-foreground">Pause Disco during the news window; regular music plays if no bulletin is configured.</p></div>
        <Switch id="news-enabled" checked={data?.newsEnabled ?? true} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { newsEnabled: checked })} /></div>
      <div className="flex items-center justify-between gap-3"><div><Label htmlFor="dj-mic-enabled">DJ Mic</Label><p className="text-xs text-muted-foreground">Play a recorded microphone announcement to every listener after the current track.</p></div>
        <Switch id="dj-mic-enabled" checked={data?.djMicEnabled ?? false} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { djMicEnabled: checked })} /></div>
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start gap-2"><Clock3 className="mt-0.5 size-4 text-primary" aria-hidden="true" /><div><Label>Broadcast schedule</Label><p className="text-xs text-muted-foreground">Choose when the station signs off and signs on again, Manila time.</p></div></div>
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
      <div><Label>Disco schedule</Label><p className="text-xs text-muted-foreground">Choose when the Disco program starts and ends, Manila time.</p></div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium">Disco start
          <select value={discoStartHour} onChange={(event) => setDiscoStartHour(event.target.value)} disabled={!data || busy} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring">{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">Disco end
          <select value={discoEndHour} onChange={(event) => setDiscoEndHour(event.target.value)} disabled={!data || busy} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring">{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select>
        </label>
      </div>
      <Button variant="secondary" disabled={!data || busy || discoStartHour === discoEndHour} onClick={() => send('PUT', { discoStartHour: Number(discoStartHour), discoEndHour: Number(discoEndHour) })}>Save Disco schedule</Button>
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

    <div className="grid grid-cols-2 gap-2">
      <Stat label="Listeners now" value={data?.listenersNow ?? '–'} />
      <Stat label="Songs / 7 days" value={data?.songsThisWeek ?? '–'} />
      <Stat label="Artists / hour" value={data?.artistsThisHour ?? '–'} />
      <Stat label="Queued tracks" value={data?.queued ?? '–'} />
      <Stat label="Heart ratings" value={data?.totalRatings ?? '–'} />
      <Stat label="Pending requests" value={data?.pendingRequests ?? '–'} />
    </div>
    <p className="-mt-2 text-[11px] text-muted-foreground">Estimated browsers currently playing; inactive sessions expire after one minute.</p>
    <RequestInbox />

    <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label htmlFor="upload-golden-sunday">Golden Sunday</Label>
        <p className="text-xs text-muted-foreground">Sunday 4:00 AM–1:00 PM only · one play after every 3 songs · regular jingle and commercial breaks are suppressed</p></div>
      <label htmlFor="upload-golden-sunday" className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-secondary ${busy ? 'pointer-events-none opacity-50' : ''}`}>
        <Upload className="size-4" aria-hidden="true" /> {data?.goldenSunday ? 'Replace Golden Sunday audio' : 'Upload Golden Sunday audio'}</label>
      <input id="upload-golden-sunday" type="file" accept="audio/*" className="sr-only" disabled={busy}
        onChange={(event) => { void upload('golden-sunday', event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
      {data?.goldenSunday && <a href={data.goldenSunday.url} target="_blank" rel="noreferrer" className="truncate text-xs text-primary underline">Current: {data.goldenSunday.name}</a>}
    </div>
    <p className="text-[11px] text-muted-foreground">Christmas rotation: September–October one in every five songs; November three in a row, then regular songs; December three Christmas songs out of every four; normal rotation resumes in January.</p>

    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div><Label>Shared DJ Mic</Label><p className="text-xs text-muted-foreground">Record a smooth microphone clip. It is uploaded and queued after the current track so every listener hears it.</p></div>
      <div className="flex flex-wrap gap-2">
        {!recording ? <Button type="button" variant="secondary" disabled={!data?.djMicEnabled || busy} onClick={() => void startDjRecording()}><Mic2 aria-hidden="true" /> Record DJ Mic</Button> : <Button type="button" variant="destructive" onClick={stopDjRecording}><Square aria-hidden="true" /> Stop and broadcast</Button>}
        {!data?.djMicEnabled && <span className="self-center text-xs text-muted-foreground">Turn on DJ Mic above first.</span>}
      </div>
      {data?.djMic && <p className="truncate text-xs text-muted-foreground">Last clip: {data.djMic.name}</p>}
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3"><div><Label htmlFor="jingle-enabled">Jingle</Label><p className="text-xs text-muted-foreground">One jingle after every 4 songs, except during Golden Sunday</p></div>
        <Switch id="jingle-enabled" checked={data?.jingleEnabled ?? false} disabled={!data || busy}
          onCheckedChange={(checked) => send('PUT', { jingleEnabled: checked })} /></div>
      <label htmlFor="upload-jingle" className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-secondary ${busy ? 'pointer-events-none opacity-50' : ''}`}>
        <Upload className="size-4" aria-hidden="true" /> {data?.jingle ? 'Replace jingle audio' : 'Upload jingle audio'}</label>
      <input id="upload-jingle" type="file" accept="audio/*" className="sr-only" disabled={busy}
        onChange={(event) => { void upload('jingle', event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
      {data?.jingle && <a href={data.jingle.url} target="_blank" rel="noreferrer" className="truncate text-xs text-primary underline">Current: {data.jingle.name}</a>}
    </div>

    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3"><div><Label htmlFor="commercial-enabled">Commercials</Label><p className="text-xs text-muted-foreground">Play saved slots after the jingle, except during Golden Sunday</p></div>
        <Switch id="commercial-enabled" checked={data?.commercialEnabled ?? false} disabled={!data || busy}
          onCheckedChange={(checked) => send('PUT', { commercialEnabled: checked })} /></div>
      {[0, 1, 2].map((slot) => {
        const asset = data?.commercials?.[slot]
        return <div key={slot} className="flex flex-col gap-1 border-t border-border pt-2">
          <label htmlFor={`upload-commercial-${slot}`} className={`flex cursor-pointer items-center gap-2 text-sm hover:text-primary ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            <Upload className="size-3.5" aria-hidden="true" /> {asset ? `Replace commercial ${slot + 1}` : `Upload commercial ${slot + 1}`}</label>
          <input id={`upload-commercial-${slot}`} type="file" accept="audio/*" className="sr-only" disabled={busy}
            onChange={(event) => { void upload('commercial', event.currentTarget.files?.[0], slot); event.currentTarget.value = '' }} />
          {asset && <a href={asset.url} target="_blank" rel="noreferrer" className="truncate text-xs text-primary underline">{asset.name}</a>}
        </div>
      })}
    </div>
    {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    {message && <p className="text-xs text-emerald-400" role="status">{message}</p>}
    <Button variant="secondary" disabled={busy} onClick={() => send('POST')}>
      <RefreshCw className={busy ? 'animate-spin' : undefined} aria-hidden="true" /> Refresh rotation
    </Button>
    <p className="text-xs leading-relaxed text-muted-foreground">Outside Golden Sunday, after every four songs, enabled and uploaded spots play once in order; missing or disabled spots are skipped. Music resumes automatically afterward. Automated songs only. Strict rules: no AI, no covers, no rock, English &amp; Tagalog only, no repeat song within 7 days, max 2 plays per artist per hour.</p>
  </div>
}
