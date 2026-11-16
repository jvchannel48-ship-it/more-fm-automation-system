'use client'

import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type RequestResponse = {
  accepted?: boolean
  queued?: boolean
  message?: string
  error?: string
}

export function SongRequestPanel() {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const cleanName = name.trim()
    const cleanTitle = title.trim()
    const cleanArtist = artist.trim()
    if (!cleanName || !cleanTitle || !cleanArtist || busy) return
    setBusy(true)
    setMessage('Searching for your song and preparing your request…')
    setError('')
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, song_title: cleanTitle, artist: cleanArtist }),
      })
      const result = await response.json() as RequestResponse
      if (!response.ok) throw new Error(result.error ?? 'The song request could not be submitted.')
      setMessage(result.message ?? 'Successful! Your song is queued and will play next after the current song. Please wait for the current song to finish; it will play automatically.')
      setTitle('')
      setArtist('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The song request could not be submitted.')
      setMessage('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-border/70 bg-background/45 p-4 shadow-sm" aria-label="Song request">
      <h2 className="text-center text-lg font-semibold">Song Request</h2>
      <p className="mt-1 text-center text-xs text-muted-foreground">Send your song request to the station queue.</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" maxLength={80} required disabled={busy} />
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Song title" maxLength={200} required disabled={busy} />
        <Input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Artist" maxLength={120} required disabled={busy} />
        {message && <p className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm text-primary" role="status" aria-live="polite">{message}</p>}
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" disabled={busy || !name.trim() || !title.trim() || !artist.trim()}>
          {busy ? <><Loader2 className="animate-spin" /> Searching…</> : <><Send /> Submit song request</>}
        </Button>
      </form>
    </section>
  )
}
