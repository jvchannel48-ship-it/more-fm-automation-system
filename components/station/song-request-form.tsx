'use client'

import { useState, type FormEvent } from 'react'
import { CheckCircle2, ListMusic, Loader2, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RequestResponse {
  queued?: boolean
  reason?: string
  track?: { title: string; artist: string }
}

async function readResponse(response: Response) {
  const result = await response.json().catch(() => null) as (RequestResponse & { error?: string }) | null
  if (!response.ok) throw new Error(result?.error ?? 'The song request could not be submitted.')
  return result ?? {}
}

export function SongRequestForm() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage('Searching YouTube and adding your song to AutoDJ…')
    setError('')
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist }),
      })
      const result = await readResponse(response)
      setMessage(result.queued
        ? `Request successful. ${result.track?.title ?? title} will play automatically after the queued songs.`
        : result.reason ?? 'Request saved. AutoDJ will keep checking for it.')
      setTitle('')
      setArtist('')
    } catch (reason) {
      setMessage('')
      setError(reason instanceof Error ? reason.message : 'The song request could not be submitted.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="relative w-full max-w-md">
      <Button type="button" className="w-full justify-center" onClick={() => { setOpen((value) => !value); setError(''); setMessage('') }} aria-expanded={open}>
        <ListMusic aria-hidden="true" /> Request a song
      </Button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-3 w-full rounded-2xl border border-primary/35 bg-card/95 p-4 text-left shadow-2xl backdrop-blur-xl" role="dialog" aria-label="Request a song">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Send a song request</h2>
              <p className="mt-1 text-xs text-muted-foreground">AutoDJ will find it, add it to the playlist, and play it automatically.</p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close song request"><X aria-hidden="true" /></Button>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="song-request-title">Song title</Label>
              <Input id="song-request-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Hanggang Ngayon" maxLength={160} required disabled={busy} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="song-request-artist">Artist</Label>
              <Input id="song-request-artist" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="e.g. Ogie Alcasid" maxLength={120} required disabled={busy} />
            </div>
            <Button type="submit" disabled={busy || !title.trim() || !artist.trim()}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              {busy ? 'Adding to AutoDJ…' : 'Submit request'}
            </Button>
          </form>
          {message && <p className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed text-emerald-200" role="status" aria-live="polite"><CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{message}</p>}
          {error && <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive" role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}
