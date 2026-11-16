'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { AdminStatus } from '@/lib/types'

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error('Unauthorized')
    return r.json() as Promise<AdminStatus>
  })

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-secondary px-3 py-2">
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

export function AdminPanel() {
  const { data, mutate } = useSWR('/api/admin/settings', fetcher, { refreshInterval: 15000 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const send = async (method: 'PUT' | 'POST', body?: object) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/settings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const result = await res.json().catch(() => ({})) as Partial<AdminStatus> & { error?: string }
      if (!res.ok) throw new Error(result.error ?? 'Hindi na-save ang admin setting.')
      const status = result as AdminStatus
      mutate(status, { revalidate: false })
      setMessage(method === 'PUT'
        ? status.persistenceConfigured ? 'Nai-save ang Broadcast setting sa Blob.' : 'Na-toggle ang Broadcast, pero pansamantala lang ito sa server memory.'
        : 'Na-refresh ang music rotation.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hindi na-save ang admin setting.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="broadcast">Broadcast</Label>
          <span className="text-xs text-muted-foreground">
            {data?.broadcastEnabled === false ? 'Naka-off ang livestream' : 'Auto on 4:00 AM · auto off 1:00 AM'}
          </span>
        </div>
        <Switch
          id="broadcast"
          checked={data?.broadcastEnabled ?? true}
          disabled={!data || busy}
          onCheckedChange={(checked) => send('PUT', { broadcastEnabled: checked })}
        />
      </div>

      {data?.persistenceConfigured === false && (
        <p className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-100" role="status">
          Walang durable Blob storage. Broadcast changes at listener total ay pansamantala at maaaring mawala sa restart o magkaiba sa server instances. Ikonekta ang Vercel Blob o i-set ang BLOB_READ_WRITE_TOKEN.
        </p>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {message && <p className="text-xs text-emerald-300" role="status">{message}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Songs / 7 days" value={data?.songsThisWeek ?? '–'} />
        <Stat label="Artists / hour" value={data?.artistsThisHour ?? '–'} />
        <Stat label="Queued" value={data?.queued ?? '–'} />
        <Stat label="Listeners now" value={data?.listenersNow ?? '–'} />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div><Label htmlFor="tagalog-only-enabled">Tagalog old songs · {data?.tagalogOnlyEnabled ? 'ON' : 'OFF'}</Label><p className="text-xs text-muted-foreground">ON: tuloy-tuloy ang magagandang Tagalog old songs at classic OPM artists. OFF: babalik sa regular English/Tagalog rotation. Kapag ON, ino-off nito ang Classic Love mode. Tatapusin muna ang current at already queued na kanta/request bago magpalit ng rotation.</p></div>
        <Switch id="tagalog-only-enabled" checked={data?.tagalogOnlyEnabled ?? true} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { tagalogOnlyEnabled: checked })} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center justify-between gap-3"><div><Label htmlFor="christmas-enabled">Christmas song pair</Label><p className="text-xs text-muted-foreground">During Sep–Dec, ON adds two back-to-back songs to the seasonal rotation: Tagalog first, then English. The pair pauses in Tagalog-only or Classic Love mode; current and already queued songs finish first.</p></div>
          <Switch id="christmas-enabled" checked={data?.christmasEnabled ?? false} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { christmasEnabled: checked })} /></div>
        <div className="flex items-center justify-between gap-3"><div><Label htmlFor="classic-love-enabled">Classic Love Songs</Label><p className="text-xs text-muted-foreground">ON plays English classic love songs continuously, with James Ingram and a “Just Once” search, instead of the regular schedule. Christmas pairs and pending song requests wait. Turning this ON disables Tagalog-only; turning Tagalog-only ON later disables this mode. Current and already queued songs finish first.</p></div>
          <Switch id="classic-love-enabled" checked={data?.classicLoveSongsEnabled ?? false} disabled={!data || busy} onCheckedChange={(checked) => send('PUT', { classicLoveSongsEnabled: checked })} /></div>
      </div>

      <Button variant="secondary" disabled={busy} onClick={() => send('POST')}>
        <RefreshCw className={busy ? 'animate-spin' : undefined} aria-hidden="true" />
        Refresh rotation
      </Button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Automated songs only. Strict rules: no AI, no covers, no rock, English &amp; Tagalog only, no repeat song
        within 7 days, max 2 plays per artist per hour.
      </p>
    </div>
  )
}
