'use client'

import { useEffect, useState } from 'react'
import { Loader2, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type RequestResponse = {
  queued?: boolean
  reason?: string
  error?: string
}

export function PlaylistMenu() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'info' | 'error'>('info')

  useEffect(() => {
    if (!open) {
      setName('')
      setTitle('')
      setArtist('')
      setMessage('')
      setMessageTone('info')
    }
  }, [open])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const cleanName = name.trim()
    const cleanTitle = title.trim()
    const cleanArtist = artist.trim()
    if (!cleanName || !cleanTitle || !cleanArtist) return

    setSubmitting(true)
    setMessage('Searching for your song and preparing your request…')
    setMessageTone('info')
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, song_title: cleanTitle, artist: cleanArtist }),
      })
      const result = await response.json() as RequestResponse
      if (!response.ok) throw new Error(result.error ?? 'Hindi naisumite ang request. Subukan muli.')

      if (result.queued) {
        setMessage('Your song request submitted. It will play after the current song queue.')
      } else {
        setMessage(result.reason ?? 'Your song request submitted. Please wait for play.')
      }
      setTitle('')
      setArtist('')
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Hindi naisumite ang request. Subukan muli.')
      setMessageTone('error')
    } finally {
      setSubmitting(false)
    }
  }

  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger render={<Button variant="outline" size="sm" className="h-9 shrink-0 rounded-full px-2 shadow-sm sm:px-3" aria-label="Open song request form" />}>
      <MessageCircle aria-hidden="true" /> <span className="hidden sm:inline">Request</span>
    </SheetTrigger>
    <SheetContent side="right" className="w-full sm:max-w-lg">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2"><MessageCircle className="size-5 text-primary" /> SEND ME YOUR SONG REQUEST</SheetTitle>
        <SheetDescription>Type your name, song title, and artist. The request will be searched and prepared for play.</SheetDescription>
      </SheetHeader>
      <form onSubmit={submit} className="flex flex-col gap-4 px-4 pb-8">
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
          Ilagay ang pangalan mo at ang title at artist ng kanta. Pag-submit, hahanapin ito at ilalagay sa pila.
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="song-request-name">
          Your name
          <Input id="song-request-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Halimbawa: Juan" maxLength={80} required disabled={submitting} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="song-request-title">
          Song title
          <Input id="song-request-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Halimbawa: Ikaw Lamang" maxLength={200} required disabled={submitting} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="song-request-artist">
          Artist
          <Input id="song-request-artist" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Halimbawa: Janno Gibbs" maxLength={120} required disabled={submitting} />
        </label>
        {message && <p className={`rounded-xl border px-3 py-3 text-sm leading-relaxed ${messageTone === 'error' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-primary/25 bg-primary/5 text-primary'}`} role="status" aria-live="polite">{message}</p>}
        <Button type="submit" disabled={submitting || !name.trim() || !title.trim() || !artist.trim()}>
          {submitting ? <><Loader2 className="animate-spin" /> Searching and submitting…</> : <><Send /> Submit song request</>}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Your request is read by the station queue. It may play after one or several songs.</p>
      </form>
    </SheetContent>
  </Sheet>
}
