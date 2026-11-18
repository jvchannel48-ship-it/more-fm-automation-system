'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Megaphone, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SIGN_OFF_HOUR, SIGN_ON_HOUR } from '@/lib/schedule'
import { MAX_BASS_BOOST_DB, type AdminStatus } from '@/lib/types'

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
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationFile, setNotificationFile] = useState<File | null>(null)
  const [blockedGenres, setBlockedGenres] = useState<string[]>([])
  const [genreInput, setGenreInput] = useState('')

  useEffect(() => {
    if (data) {
      setBassBoostInput(String(data.bassBoostDb ?? 0))
      setBlockedGenres(data.blockedGenres ?? [])
    }
  }, [data?.bassBoostDb, data?.blockedGenres])

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
        blockedGenres?: string[]
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
      } else if (Array.isArray(values?.blockedGenres)) {
        setMessage(status.persistenceConfigured
          ? 'Na-save ang blocked genre filter at ni-refresh ang rotation.'
          : 'Na-update ang blocked genre filter, pero pansamantala lang ito sa server memory.')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hindi na-save ang admin setting.')
    } finally {
      setBusy(false)
    }
  }

  const saveBassBoost = () => {
    const value = Number(bassBoostInput)
    if (!Number.isFinite(value) || value < 0 || value > MAX_BASS_BOOST_DB) {
      setError(`Enter a bass boost from 0 to +${MAX_BASS_BOOST_DB} dB.`)
      return
    }
    void send('PUT', { bassBoostDb: value })
  }

  const updateBlockedGenres = (next: string[]) => {
    const normalized = [...new Set(
      next.flatMap((genre) => genre.split(',').map((item) => item.trim().toLowerCase())).filter(Boolean),
    )].slice(0, 30)
    setBlockedGenres(normalized)
    void send('PUT', { blockedGenres: normalized })
  }

  const addBlockedGenre = () => {
    const genres = genreInput.split(',').map((genre) => genre.trim().toLowerCase()).filter(Boolean)
    if (genres.length === 0) return
    if (genres.every((genre) => blockedGenres.includes(genre))) {
      setGenreInput('')
      return
    }
    setGenreInput('')
    updateBlockedGenres([...blockedGenres, ...genres])
  }

  const sendNotification = async () => {
    if (!notificationTitle.trim() || !notificationMessage.trim()) {
      setError('Maglagay ng title at message bago mag-send ng notification.')
      return
    }
    if (!window.confirm('I-send ang notification na ito sa lahat ng listeners?')) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const form = new FormData()
      form.set('title', notificationTitle.trim())
      form.set('message', notificationMessage.trim())
      form.set('confirmed', 'true')
      if (notificationFile) form.set('file', notificationFile)
      const response = await fetch('/api/notifications', { method: 'POST', body: form })
      const result = await response.json().catch(() => ({})) as { error?: string; persistenceConfigured?: boolean }
      if (!response.ok) throw new Error(result.error ?? 'Hindi na-send ang notification.')
      setNotificationTitle('')
      setNotificationMessage('')
      setNotificationFile(null)
      setMessage(result.persistenceConfigured === false
        ? 'Na-send ang notification, pero pansamantala lang ito sa server memory.'
        : 'Na-send na ang notification sa lahat ng listeners.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hindi na-send ang notification.')
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

      <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-secondary/40 p-3">
        <Label htmlFor="bass-boost-db">Bass boost (dB)</Label>
        <div className="flex items-center gap-2">
          <input
            id="bass-boost-db"
            type="number"
            min={0}
            max={MAX_BASS_BOOST_DB}
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
          Set 0–{MAX_BASS_BOOST_DB} dB. 0 dB is neutral; 12 dB is the safe maximum with automatic headroom and a gentle limiter to prevent muddy or buried sound.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-secondary/40 p-3">
        <div>
          <Label htmlFor="blocked-genre">Genre filter / block</Label>
          <p className="mt-1 text-xs text-muted-foreground">I-enter ang genre na ayaw mong mapasama sa rotation, tulad ng disco, dance, rock. Puwedeng comma-separated.</p>
        </div>
        <div className="flex gap-2">
          <input
            id="blocked-genre"
            value={genreInput}
            onChange={(event) => setGenreInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addBlockedGenre()
              }
            }}
            placeholder="disco, dance, rock"
            disabled={busy}
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button type="button" variant="secondary" disabled={busy || !genreInput.trim()} onClick={addBlockedGenre}>Add</Button>
        </div>
        {blockedGenres.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Blocked genres">
            {blockedGenres.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => updateBlockedGenres(blockedGenres.filter((item) => item !== genre))}
                disabled={busy}
                className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/20 disabled:opacity-50"
                title={`Remove ${genre} block`}
              >
                {genre} ×
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Walang naka-block na genre.</p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-secondary/40 to-card p-4 shadow-inner shadow-primary/5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Megaphone className="size-5" aria-hidden="true" />
          </div>
          <div>
            <Label htmlFor="notification-title" className="text-base">Send all notification</Label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Mag-send ng text announcement sa lahat ng listeners. Optional lang ang image o .txt attachment.</p>
          </div>
        </div>
        <input
          id="notification-title"
          value={notificationTitle}
          onChange={(event) => setNotificationTitle(event.target.value)}
          maxLength={120}
          placeholder="Notification title"
          disabled={busy}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
        <textarea
          value={notificationMessage}
          onChange={(event) => setNotificationMessage(event.target.value)}
          maxLength={3000}
          rows={4}
          placeholder="I-type dito ang message para sa lahat ng listeners..."
          disabled={busy}
          className="resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          type="file"
          accept="image/*,.txt,text/plain"
          onChange={(event) => setNotificationFile(event.target.files?.[0] ?? null)}
          disabled={busy}
          className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
        />
        <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span>{notificationFile ? `Attached: ${notificationFile.name}` : 'Text-only notification'}</span>
          <span>{notificationMessage.length}/3000</span>
        </div>
        <Button type="button" disabled={busy || !notificationTitle.trim() || !notificationMessage.trim()} onClick={sendNotification} className="h-11 shadow-lg shadow-primary/15">
          <Send aria-hidden="true" />
          Send all notification
        </Button>
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
        Mellow easy-listening sa regular rotation; espesyal ang Sunday schedule kapag naka-ON. Walang AI o cover/remix; duplicate song uploads ay iniiwasan sa loob ng 7 araw.
      </p>
    </div>
  )
}
