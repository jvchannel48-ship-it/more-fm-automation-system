'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, Heart, Loader2, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
      .then((response) => response.json())
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
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Your rating could not be saved. Please try again.')
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
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Your song request could not be submitted. Please try again.')
      setRequestMessage('AutoDJ has received and is checking your request. If a suitable version is available, it will be queued for the next available slot after songs already playing or queued. Please wait; it may take a little while to come on.')
      setTitle('')
      setArtist('')
    } catch (reason) {
      setRequestError(reason instanceof Error ? reason.message : 'Your song request could not be submitted. Please try again.')
    } finally {
      setRequestBusy(false)
    }
  }

  return <div className="flex w-full max-w-md flex-col gap-3">
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button
        type="button"
        variant={rated ? 'secondary' : 'outline'}
        onClick={() => void rate()}
        disabled={rated || ratingBusy}
        className={`rounded-full ${rated ? 'text-rose-400' : ''}`}
        aria-label={rated ? 'Thanks for rating MOR 93.5' : 'Rate MOR 93.5'}
      >
        {ratingBusy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Heart className={rated ? 'fill-current' : undefined} aria-hidden="true" />}
        {ratingBusy ? 'Saving rating…' : rated ? 'Thanks for rating us!' : 'Rate this station'}
      </Button>
      <span className="text-xs tabular-nums text-muted-foreground">
        {ratingTotal} {ratingTotal === 1 ? 'rating' : 'ratings'}
      </span>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setOpen((value) => !value)
          setRequestMessage('')
          setRequestError('')
        }}
        aria-expanded={open}
      >
        <MessageCircle aria-hidden="true" /> {open ? 'Close request' : 'Request a song'}
      </Button>
    </div>

    {ratingMessage && <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left text-emerald-100" role="status" aria-live="polite">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden="true" />
      <div><p className="text-sm font-semibold">Rating received</p><p className="text-xs text-emerald-100/80">{ratingMessage}</p></div>
    </div>}
    {ratingError && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{ratingError}</p>}

    {open && <form onSubmit={submitRequest} className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-card/80 p-4 text-left shadow-xl shadow-black/20 backdrop-blur">
      <div>
        <h3 className="font-semibold">Request a song</h3>
        <p className="text-xs text-muted-foreground">AutoDJ checks each request and queues a suitable match for an available slot. Songs already playing or queued come first.</p>
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
      <Button type="submit" disabled={requestBusy || !title.trim() || !artist.trim()} aria-busy={requestBusy}>
        {requestBusy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
        {requestBusy ? 'Submitting…' : 'Submit song request'}
      </Button>
      {requestMessage && <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-100" role="status" aria-live="polite">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden="true" />
        <div><p className="text-sm font-semibold">Request submitted successfully</p><p className="text-xs leading-relaxed text-emerald-100/80">{requestMessage}</p></div>
      </div>}
      {requestError && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{requestError}</p>}
    </form>}
  </div>
}
