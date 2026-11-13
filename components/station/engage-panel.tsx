'use client'

import { useEffect, useState } from 'react'
import { Heart, MessageCircle, Send } from 'lucide-react'
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
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setRated(localStorage.getItem('morefm-rated') === 'true')
    void fetch('/api/rating').then((response) => response.json()).then((result) => setRatingTotal(result.total ?? 0)).catch(() => undefined)
  }, [])

  const rate = async () => {
    if (rated) return
    const response = await fetch('/api/rating', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voterId: browserId() }) })
    if (!response.ok) return
    const result = await response.json()
    setRatingTotal(result.total ?? ratingTotal)
    setRated(true)
    localStorage.setItem('morefm-rated', 'true')
  }

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true); setMessage(''); setError('')
    try {
      const response = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, artist }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'The request could not be submitted.')
      setMessage(result.message)
      setTitle(''); setArtist('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The request could not be submitted.')
    } finally { setBusy(false) }
  }

  return <div className="flex w-full max-w-md flex-col gap-3">
    <div className="flex items-center justify-center gap-2">
      <Button type="button" variant={rated ? 'secondary' : 'outline'} onClick={() => void rate()} className={`rounded-full ${rated ? 'text-rose-400' : ''}`} aria-label="Rate this station with a heart">
        <Heart className={rated ? 'fill-current' : undefined} aria-hidden="true" /> {rated ? 'Thanks for the heart' : 'Rate with a heart'}
      </Button>
      <span className="text-xs tabular-nums text-muted-foreground">{ratingTotal} ratings</span>
      <Button type="button" variant="ghost" onClick={() => { setOpen((value) => !value); setMessage(''); setError('') }} aria-expanded={open}>
        <MessageCircle aria-hidden="true" /> Message
      </Button>
    </div>
    {open && <form onSubmit={submitRequest} className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-card/80 p-4 text-left shadow-xl shadow-black/20 backdrop-blur">
      <div><h3 className="font-semibold">Song request</h3><p className="text-xs text-muted-foreground">Send the title and artist. We will review the request and add it to the next rotation when available.</p></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="request-title">Song title</Label><Input id="request-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Ikaw" required maxLength={120} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="request-artist">Artist</Label><Input id="request-artist" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Example: Yeng Constantino" required maxLength={120} /></div>
      <Button type="submit" disabled={busy || !title.trim() || !artist.trim()}><Send aria-hidden="true" /> {busy ? 'Sending...' : 'Submit request'}</Button>
      {message && <p className="text-xs text-emerald-400" role="status">{message}</p>}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </form>}
  </div>
}
