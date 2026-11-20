'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { BadgeCheck, ImagePlus, Megaphone, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SIGN_OFF_HOUR, SIGN_ON_HOUR } from '@/lib/schedule'
import { MAX_BASS_BOOST_DB, type AdminStatus } from '@/lib/types'
import { STRICT_CLASSIC_LOVE_GENRES } from '@/lib/song-filter'
import { AdminCreditControls } from './admin-credit-controls'

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
  const [transmitterWatts, setTransmitterWatts] = useState<5000 | 25000>(25000)
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationFiles, setNotificationFiles] = useState<File[]>([])
  const [blockedGenres, setBlockedGenres] = useState<string[]>([])
  const [genreInput, setGenreInput] = useState('')
  const [rjAutoMessage, setRjAutoMessage] = useState('')
  const [confirmSendNotif, setConfirmSendNotif] = useState(false)

  useEffect(() => {
    if (data) {
      setBassBoostInput(String(data.bassBoostDb ?? 0))
      setTransmitterWatts(data.transmitterWatts === 5000 ? 5000 : 25000)
      setBlockedGenres(data.blockedGenres ?? [])
      setRjAutoMessage(data.rjOfficialAutoMessage ?? '')
    }
  }, [data?.bassBoostDb, data?.blockedGenres, data?.transmitterWatts])

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
      if (!res.ok) throw new Error(result.error ?? 'Could not save admin setting.')
      const status = result as AdminStatus
      mutate(status, { revalidate: false })
      if (method === 'POST') setMessage('Music rotation refreshed.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save admin setting.')
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

  const saveTransmitterWatts = (value: string) => {
    const watts = value === '5000' ? 5000 : 25000
    setTransmitterWatts(watts)
    void send('PUT', { transmitterWatts: watts })
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

  const applyStrictClassicLoveFilter = () => {
    updateBlockedGenres([...new Set([...blockedGenres, ...STRICT_CLASSIC_LOVE_GENRES])])
  }

  const saveRjAutoMessage = () => {
    void send('PUT', { rjOfficialAutoMessage: rjAutoMessage })
  }

  const sendNotification = async () => {
    if (!notificationTitle.trim() || !notificationMessage.trim()) {
      setError('Add a title and message before sending a notification.')
      return
    }
    setConfirmSendNotif(false)
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const form = new FormData()
      form.set('title', notificationTitle.trim())
      form.set('message', notificationMessage.trim())
      form.set('confirmed', 'true')
      for (const file of notificationFiles) form.append('files', file)
      const response = await fetch('/api/notifications', { method: 'POST', body: form })
      const result = await response.json().catch(() => ({})) as { error?: string; persistenceConfigured?: boolean }
      if (!response.ok) throw new Error(result.error ?? 'Could not send the notification.')
      setNotificationTitle('')
      setNotificationMessage('')
      setNotificationFiles([])
      setMessage(result.persistenceConfigured === false
        ? 'Notification sent (temporary server memory only).'
        : 'Notification sent to all listeners.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send the notification.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <AdminCreditControls />
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="broadcast">Manila 93.5 Broadcast</Label>
          <span className="text-xs text-muted-foreground">
            {data?.broadcastEnabled === false
              ? `RJ FM Manila 93.5 only is off · regional stations stay live · auto ON ${SIGN_ON_HOUR}:00 AM / auto OFF ${SIGN_OFF_HOUR}:00 AM`
              : `RJ FM Manila 93.5 + DZMM schedule · regional stations stay live · auto ON ${SIGN_ON_HOUR}:00 AM / auto OFF ${SIGN_OFF_HOUR}:00 AM`}
          </span>
        </div>
        <Switch
          id="broadcast"
          checked={data?.broadcastEnabled ?? true}
          disabled={!data || busy}
          onCheckedChange={(checked) => send('PUT', { broadcastEnabled: checked })}
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-secondary/40 p-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="transmitter-watts">Transmitter power</Label>
          <span className="text-xs text-muted-foreground">
            {transmitterWatts === 25000 ? '25k watts · stronger signal · clean audio' : '5k watts · weaker signal · light static may be heard'}
          </span>
        </div>
        <select
          id="transmitter-watts"
          value={transmitterWatts}
          disabled={!data || busy}
          onChange={(event) => saveTransmitterWatts(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="25000">25k watts</option>
          <option value="5000">5k watts</option>
        </select>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="sunday-schedule">Sunday special schedule</Label>
          <span className="text-xs text-muted-foreground">
            {data?.sundayScheduleEnabled === false
              ? 'OFF · normal mellow rotation on Sunday'
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
          />
          <span className="text-sm text-muted-foreground">dB</span>
          <Button type="button" variant="secondary" disabled={!data || busy} onClick={saveBassBoost}>
            Apply bass
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-secondary/40 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label htmlFor="blocked-genre">Genre filter / block</Label>
            <p className="mt-1 text-xs text-muted-foreground">Enter genres to keep out of rotation (e.g. disco, dance, rock).</p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={applyStrictClassicLoveFilter}>Strict classic love</Button>
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
              >
                {genre} ×
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No blocked genres.</p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-secondary/40 to-card p-4 shadow-inner shadow-primary/5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Megaphone className="size-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="notification-title" className="text-base">RJ FM OFFICIAL</Label>
              <BadgeCheck className="size-4 fill-sky-500 text-white" aria-label="Verified account" />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Send a short announcement to all listeners. You can attach up to 3 images.</p>
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
          placeholder="Type the message for all listeners..."
          disabled={busy}
          className="resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => setNotificationFiles(Array.from(event.target.files ?? []).slice(0, 3))}
          disabled={busy}
          className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
        />
        <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><ImagePlus className="size-3.5" />{notificationFiles.length ? `${notificationFiles.length}/3 image${notificationFiles.length === 1 ? '' : 's'} attached` : 'No images attached'}</span>
          <span>{notificationMessage.length}/3000</span>
        </div>
        <Button
          type="button"
          disabled={busy || !notificationTitle.trim() || !notificationMessage.trim()}
          onClick={() => setConfirmSendNotif(true)}
          className="h-11 shadow-lg shadow-primary/15"
        >
          <Send aria-hidden="true" />
          Send all notification
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-sky-400/25 bg-gradient-to-br from-sky-400/10 via-secondary/40 to-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="rj-official-auto">RJ FM OFFICIAL auto message</Label>
              <BadgeCheck className="size-4 fill-sky-500 text-white" aria-label="Verified account" />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">When ON, sends varied Hello / keep-the-music messages every 8 minutes to active listeners.</p>
          </div>
          <Switch
            id="rj-official-auto"
            checked={data?.rjOfficialAutoEnabled ?? false}
            disabled={!data || busy}
            onCheckedChange={(checked) => send('PUT', { rjOfficialAutoEnabled: checked })}
          />
        </div>
        <textarea
          value={rjAutoMessage}
          onChange={(event) => setRjAutoMessage(event.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Optional custom message. Leave blank for varied Hello messages."
          disabled={busy}
          className="resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">Blank = automatic varied messages.</span>
          <Button type="button" variant="secondary" disabled={!data || busy} onClick={saveRjAutoMessage}>Save auto message</Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {message && <p className="text-xs text-emerald-300" role="status">{message}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Songs / 7 days" value={data?.songsThisWeek ?? '–'} />
        <Stat label="Artists / hour" value={data?.artistsThisHour ?? '–'} />
        <Stat label="Queued" value={data?.queued ?? '–'} />
        <Stat label="Total listeners" value={data?.listenersNow ?? '–'} />
        <Stat label="Average listeners" value={data?.averageListeners ?? '–'} />
      </div>

      <Button variant="secondary" disabled={busy} onClick={() => send('POST')}>
        <RefreshCw className={busy ? 'animate-spin' : undefined} aria-hidden="true" />
        Refresh rotation
      </Button>
    </div>

    {confirmSendNotif && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmSendNotif(false) }}>
        <div role="dialog" aria-modal="true" aria-labelledby="send-notif-title" className="w-full max-w-sm rounded-2xl border border-primary/30 bg-card p-5 shadow-2xl">
          <h3 id="send-notif-title" className="text-base font-semibold">Send notification?</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Send this notification to all listeners?
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirmSendNotif(false)}>Cancel</Button>
            <Button type="button" disabled={busy} onClick={() => void sendNotification()}>
              <Send className="size-4" /> Send
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
