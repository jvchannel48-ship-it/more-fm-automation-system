'use client'

import { useEffect, useState } from 'react'
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
  const [bassBoostInput, setBassBoostInput] = useState('0')

  useEffect(() => {
    if (data) setBassBoostInput(String(data.bassBoostDb ?? 0))
  }, [data?.bassBoostDb])

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
        newTagalogOpmEnabled?: boolean
        bassBoostDb?: number
        edgeTtsEnabled?: boolean
      } | undefined
      if (method === 'POST') {
        setMessage('Na-refresh ang music rotation.')
      } else if (typeof values?.sundayScheduleEnabled === 'boolean') {
        setMessage(status.persistenceConfigured
          ? values.sundayScheduleEnabled ? 'Naka-save ang Sunday schedule setting.' : 'Naka-OFF ang Sunday special; normal mellow rotation ang susunod.'
          : 'Na-toggle ang Sunday schedule, pero pansamantala lang ito sa server memory.')
      } else if (typeof values?.newTagalogOpmEnabled === 'boolean') {
        setMessage(status.persistenceConfigured
          ? values.newTagalogOpmEnabled
            ? 'Naka-ON ang modern Tagalog OPM mode at mananatili ito hanggang i-OFF mo.'
            : 'Naka-OFF ang modern Tagalog OPM mode; normal rotation na ang kasunod.'
          : 'Na-toggle ang OPM mode, pero pansamantala lang ito sa server memory.')
      } else if (typeof values?.broadcastEnabled === 'boolean') {
        setMessage(status.persistenceConfigured
          ? 'Nai-save ang Broadcast setting sa Blob.'
          : 'Na-toggle ang Broadcast, pero pansamantala lang ito sa server memory.')
      } else if (typeof values?.bassBoostDb === 'number') {
        setMessage(status.persistenceConfigured
          ? `Bass boost saved at ${status.bassBoostDb} dB.`
          : `Bass boost set to ${status.bassBoostDb} dB for this server session; durable storage is not configured.`)
      } else if (typeof values?.edgeTtsEnabled === 'boolean') {
        setMessage(status.persistenceConfigured
          ? values.edgeTtsEnabled ? 'Edge TTS DJ is ON. Christopher will speak after every two songs and before queued requests.' : 'Edge TTS DJ is OFF.'
          : 'Edge TTS setting changed for this server session; durable storage is not configured.')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hindi na-save ang admin setting.')
    } finally {
      setBusy(false)
    }
  }

  const saveBassBoost = () => {
    const value = Number(bassBoostInput)
    if (!Number.isFinite(value) || value < 0 || value > 14) {
      setError('Enter a bass boost from 0 to +14 dB.')
      return
    }
    void send('PUT', { bassBoostDb: value })
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

      <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
        <div className="flex flex-col gap-0.5">
          <Label>Edge TTS DJ — Christopher</Label>
          <span className="text-xs text-muted-foreground">
            Always ON · English en-US Christopher male voice; random Tagalog/English rotation, jokes, challenges, and request introductions.
          </span>
        </div>
        <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">ON</span>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-secondary/40 p-3">
        <Label htmlFor="bass-boost-db">Bass boost (dB)</Label>
        <div className="flex items-center gap-2">
          <input
            id="bass-boost-db"
            type="number"
            min={0}
            max={14}
            step={0.5}
            value={bassBoostInput}
            onChange={(event) => setBassBoostInput(event.target.value)}
            disabled={!data || busy}
            className="h-10 w-28 rounded-md border border-input bg-background px-3 text-sm tabular-nums"
            aria-describedby="bass-boost-help"
          />
          <span className="text-sm text-muted-foreground">dB</span>
          <Button type="button" variant="secondary" disabled={!data || busy} onClick={saveBassBoost}>
            Apply bass
          </Button>
        </div>
        <p id="bass-boost-help" className="text-xs text-muted-foreground">
          Set 0–14 dB. 0 dB is neutral; the player applies a low-frequency boost up to +14 dB.
        </p>
      </div>

      {data?.persistenceConfigured === false && (
        <p className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-100" role="status">
          Walang durable Blob storage. Broadcast, OPM, Sunday schedule, at listener settings ay pansamantala at maaaring mawala sa restart o magkaiba sa server instances. Ikonekta ang Vercel Blob o i-set ang BLOB_READ_WRITE_TOKEN.
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
