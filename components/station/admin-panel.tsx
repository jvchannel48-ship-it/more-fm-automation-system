'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SIGN_OFF_HOUR, SIGN_ON_HOUR } from '@/lib/schedule'
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
      const values = body as {
        broadcastEnabled?: boolean
        sundayScheduleEnabled?: boolean
        newTagalogNext?: boolean
        mode?: string
      } | undefined
      if (method === 'POST') {
        setMessage(values?.mode === 'new-tagalog'
          ? 'Na-update ang queue: susunod na automatic song ay bagong Tagalog OPM; prioritized ang “Marilag” ni Dionela.'
          : 'Na-refresh ang music rotation.')
      } else if (typeof values?.sundayScheduleEnabled === 'boolean') {
        setMessage(status.persistenceConfigured
          ? values.sundayScheduleEnabled ? 'Naka-save ang Sunday schedule setting.' : 'Naka-OFF ang Sunday special; normal mellow rotation ang susunod.'
          : 'Na-toggle ang Sunday schedule, pero pansamantala lang ito sa server memory.')
      } else if (typeof values?.newTagalogNext === 'boolean') {
        setMessage(values.newTagalogNext
          ? 'Naka-ON: susunod na automatic song ay bagong Tagalog OPM; uunahin ang “Marilag” ni Dionela.'
          : 'Naka-OFF ang bagong Tagalog OPM next; nakansela ang pending preference.')
      } else if (typeof values?.broadcastEnabled === 'boolean') {
        setMessage(status.persistenceConfigured
          ? 'Nai-save ang Broadcast setting sa Blob.'
          : 'Na-toggle ang Broadcast, pero pansamantala lang ito sa server memory.')
      }
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
            {data?.broadcastEnabled === false
              ? `Naka-off ang livestream · auto ON ${SIGN_ON_HOUR}:00 AM / auto OFF ${SIGN_OFF_HOUR}:00 AM`
              : `Mellow easy-listening · auto ON ${SIGN_ON_HOUR}:00 AM / auto OFF ${SIGN_OFF_HOUR}:00 AM`}
          </span>
        </div>
        <Switch
          id="broadcast"
          checked={data?.broadcastEnabled ?? true}
          disabled={!data || busy}
          onCheckedChange={(checked) => send('PUT', { broadcastEnabled: checked })}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="sunday-schedule">Sunday special schedule</Label>
          <span className="text-xs text-muted-foreground">
            {data?.sundayScheduleEnabled === false
              ? 'Naka-OFF · normal mellow rotation tuwing Sunday'
              : '4–10 AM English oldies · 10 AM–3 PM Pinoy jukebox · 3–8 PM Tagalog classics · 8 PM English love songs'}
          </span>
        </div>
        <Switch
          id="sunday-schedule"
          checked={data?.sundayScheduleEnabled ?? true}
          disabled={!data || busy}
          onCheckedChange={(checked) => send('PUT', { sundayScheduleEnabled: checked })}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="new-tagalog-next">Play new Tagalog OPM next</Label>
          <span className="text-xs text-muted-foreground">
            {data?.newTagalogNext
              ? 'Naka-ON · uunahin ang “Marilag” ni Dionela o ibang bagong Tagalog OPM'
              : 'Naka-OFF · normal song rotation'}
          </span>
        </div>
        <Switch
          id="new-tagalog-next"
          checked={data?.newTagalogNext ?? false}
          disabled={!data || busy}
          onCheckedChange={(checked) => send('PUT', { newTagalogNext: checked })}
        />
      </div>

      {data?.persistenceConfigured === false && (
        <p className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-100" role="status">
          Walang durable Blob storage. Broadcast, Sunday schedule, at listener data ay pansamantala at maaaring mawala sa restart o magkaiba sa server instances. Ikonekta ang Vercel Blob o i-set ang BLOB_READ_WRITE_TOKEN.
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

      <Button variant="secondary" disabled={busy} onClick={() => send('POST')}>
        <RefreshCw className={busy ? 'animate-spin' : undefined} aria-hidden="true" />
        Refresh rotation
      </Button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Mellow easy-listening sa regular rotation; espesyal ang Sunday schedule kapag naka-ON. Walang AI, covers, o rock; iwas-ulit ng kanta sa loob ng 7 araw.
      </p>
    </div>
  )
}
