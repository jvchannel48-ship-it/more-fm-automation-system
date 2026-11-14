'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, Heart, Loader2, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

async function readApiJson<T>(response: Response): Promise<T> {
  const result = await response.json().catch(() => null) as (T & { error?: unknown }) | null
  if (!response.ok) {
    const message = result && typeof result.error === 'string' ? result.error : `Request failed (${response.status}).`
    throw new Error(message)
  }
  if (result === null) throw new Error('The server returned an empty response. Please try again.')
  return result
}

function browserId() {
  let id = localStorage.getItem('morefm-voter-id')
  if (!id) {
    id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `voter-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem('morefm-voter-id', id)
  }
  return id
}

export function EngagePanel() {
  const [ratingTotal, setRatingTotal] = useState(0)
  const [rated, setRated] = useState(false)
  const [ratingBusy, setRatingBusy] = useState(false)
  const [ratingMessage, setRatingMessage] = useState('')
  const [ratingError, setRatingError] = useState('')
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestMessage, setRequestMessage] = useState('')
  const [requestError, setRequestError] = useState('')

  useEffect(() => {
    setRated(localStorage.getItem('morefm-rated') === 'true')
    void fetch('/api/rating')
      .then((response) => readApiJson<{ total?: number }>(response))
      .then((result) => setRatingTotal(result.total ?? 0))
      .catch(() => undefined)
  }, [])

  const rate = async () => {
    if (rated || ratingBusy) return
    setRatingBusy(true)
    setRatingMessage('')
    setRatingError('')
    try {
      const response = await fetch('/api/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId: browserId() }),
      })
      const result = await readApiJson<{ total?: number }>(response)
      setRatingTotal(result.total ?? ratingTotal)
      setRated(true)
      localStorage.setItem('morefm-rated', 'true')
      setRatingMessage('Thanks for rating us! Your support means a lot.')
    } catch (reason) {
      setRatingError(reason instanceof Error ? reason.message : 'Your rating could not be saved. Please try again.')
    } finally {
      setRatingBusy(false)
    }
  }

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (requestBusy) return
    setRequestBusy(true)
    setRequestMessage('')
    setRequestError('')
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist }),
      })
      const result = await readApiJson<{ message?: string }>(response)
      setRequestMessage(result.message ?? 'Your song request was submitted successfully.')
      setTitle('')
      setArtist('')
    } catch (reason) {
      setRequestError(reason instanceof Error ? reason.message : 'Your song request could not be submitted. Please try again.')
    } finally {
      setRequestBusy(false)
    }
  }

  return <div className="flex w-full max-w-md flex-col gap-3">
    <div className="flex w-full flex-wrap items-center justify-center gap-3">
      <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/45 py-1 pl-1 pr-3 shadow-sm">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => void rate()}
          disabled={rated || ratingBusy}
          className={`size-11 rounded-full transition-colors ${rated ? 'text-rose-400' : 'hover:text-rose-400'}`}
          aria-label={rated ? 'Thanks for rating MOR 93.5' : 'Rate MOR 93.5'}
          title={rated ? 'You rated this station' : 'Rate this station'}
        >
          {ratingBusy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Heart className={rated ? 'fill-current' : undefined} aria-hidden="true" />}
        </Button>
        <span className="min-w-12 text-left text-xs leading-tight text-muted-foreground">
          <span className="block font-semibold text-foreground">{ratingTotal}</span>
          <span>{ratingTotal === 1 ? 'rating' : 'ratings'}</span>
        </span>
      </div>
      <Button
        type="button"
        onClick={() => {
          setOpen((value) => !value)
          setRequestMessage('')
          setRequestError('')
        }}
        aria-expanded={open}
        className="h-12 min-w-48 rounded-full px-6 shadow-md shadow-primary/20 transition-transform hover:-translate-y-0.5"
      >
        <MessageCircle aria-hidden="true" /> {open ? 'Close song request' : 'Request a song'}
      </Button>
    </div>

    {ratingMessage && <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left text-emerald-100" role="status" aria-live="polite">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden="true" />
      <div><p className="text-sm font-semibold">Rating received</p><p className="text-xs text-emerald-100/80">{ratingMessage}</p></div>
    </div>}
    {ratingError && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{ratingError}</p>}

    {open && <form onSubmit={submitRequest} className="ui-depth flex flex-col gap-4 rounded-2xl border border-primary/25 bg-card/80 p-4 text-left shadow-xl shadow-black/20 backdrop-blur">
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold">Request a song</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">Requests are checked in order and played consecutively after the current song when a suitable match is available. An unmatched request stays pending without blocking later requests.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="request-title">Song title</Label>
        <Input id="request-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Ikaw" required maxLength={120} disabled={requestBusy} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="request-artist">Artist</Label>
        <Input id="request-artist" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Example: Yeng Constantino" required maxLength={120} disabled={requestBusy} />
      </div>
      {requestBusy && <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-primary"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Submitting your request…</div>
        <div className="h-1 overflow-hidden rounded-full bg-primary/15" aria-hidden="true"><div className="h-full w-full animate-pulse rounded-full bg-primary/70" /></div>
      </div>}
      <Button type="submit" disabled={requestBusy || !title.trim() || !artist.trim()} aria-busy={requestBusy} className="h-11 w-full rounded-full shadow-md shadow-primary/15">
        {requestBusy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
        {requestBusy ? 'Submitting request…' : 'Submit song request'}
      </Button>
      {requestMessage && <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-100" role="status" aria-live="polite">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden="true" />
        <div><p className="text-sm font-semibold">Request submitted successfully</p><p className="text-xs leading-relaxed text-emerald-100/80">{requestMessage}</p></div>
      </div>}
      {requestError && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{requestError}</p>}
    </form>}
  </div>
}
