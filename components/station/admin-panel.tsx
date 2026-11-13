'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { RefreshCw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { AdminStatus } from '@/lib/types'

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

  const upload = async (kind: 'jingle' | 'commercial' | 'golden-sunday', file: File | undefined, slot = 0) => {
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
      const label = kind === 'golden-sunday' ? 'Golden Sunday' : kind === 'jingle' ? 'Jingle' : `Commercial ${slot + 1}`
      setMessage(`${label} uploaded. A new selection replaces the previous file.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Audio upload failed.')
    } finally { setBusy(false) }
  }

  return <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5"><Label htmlFor="broadcast">Broadcast</Label>
        <span className="text-xs text-muted-foreground">{data?.broadcastEnabled === false ? 'Naka-off ang livestream' : 'Auto on 4:00 AM · auto off 1:00 AM'}</span></div>
      <Switch id="broadcast" checked={data?.broadcastEnabled ?? true} disabled={!data || busy}
        onCheckedChange={(checked) => send('PUT', { broadcastEnabled: checked })} />
    </div>

    <div className="grid grid-cols-2 gap-2">
      <Stat label="Listeners now" value={data?.listenersNow ?? '–'} />
      <Stat label="Songs / 7 days" value={data?.songsThisWeek ?? '–'} />
      <Stat label="Artists / hour" value={data?.artistsThisHour ?? '–'} />
      <Stat label="Queued tracks" value={data?.queued ?? '–'} />
    </div>
    <p className="-mt-2 text-[11px] text-muted-foreground">Estimated browsers currently playing; inactive sessions expire after one minute.</p>

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
