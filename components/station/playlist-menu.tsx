'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { ListMusic, Loader2, MessageCircle, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type Track = { id?: string; uid?: string; title: string; artist?: string; channel?: string; duration?: string | number; era?: string; language?: string; startAt?: number; active?: boolean }
type PlaylistData = { name: string; sections: Array<{ id: string; label: string; tracks: Track[] }>; queue: Track[]; fetchedAt: number }
type RequestResponse = { accepted?: boolean; queued?: boolean; reason?: string; error?: string }

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(async (response) => {
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Playlist unavailable')
  return data
})

function formatDuration(duration?: string | number) {
  if (typeof duration === 'string') return duration
  if (!duration || duration < 1) return ''
  return `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
}

export function PlaylistMenu() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'info' | 'error'>('info')
  const { data, error, mutate } = useSWR<PlaylistData>(open ? '/api/playlist' : null, fetcher, { refreshInterval: 15_000 })

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
    setMessage('Sending your request to the station queue…')
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
        setMessage('Request accepted. It will play automatically after the current song.')
      } else if (result.accepted) {
        setMessage(result.reason ?? 'Request saved. It will be searched and prepared for play.')
      } else {
        setMessage(result.reason ?? 'Your song request submitted. Please wait for play.')
      }
      setName('')
      setTitle('')
      setArtist('')
      await mutate()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Hindi naisumite ang request. Subukan muli.')
      setMessageTone('error')
    } finally {
      setSubmitting(false)
    }
  }

  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger render={<Button variant="outline" size="sm" className="h-9 shrink-0 rounded-full px-2 shadow-sm sm:px-3" aria-label="Open playlist" />}>
      <ListMusic aria-hidden="true" /> <span className="hidden sm:inline">Playlist</span>
    </SheetTrigger>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2"><ListMusic className="size-5 text-primary" /> RJ SONGS</SheetTitle>
        <SheetDescription>Updated songs · current queue · no-repeat rotation</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4 pb-8">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
          <span>Automatic next song is active. Songs stay in order without immediate repeats.</span>
          <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => void mutate()} aria-label="Refresh playlist"><RefreshCw className="size-3.5" /></Button>
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error.message}</p>}
        {data?.queue?.length ? <section className="space-y-2"><h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Current / Up next</h3>{data.queue.map((track) => <TrackRow key={track.uid} track={track} badge={track.active ? 'ON AIR' : 'NEXT'} />)}</section> : null}
        {data?.sections.map((section) => <section key={section.id} className="space-y-2"><div className="flex items-center justify-between"><h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{section.label}</h3><span className="text-[10px] text-muted-foreground">{section.tracks.length} songs</span></div>{section.tracks.map((track, index) => <TrackRow key={`${section.id}-${track.id ?? track.title}`} track={track} rank={index + 1} />)}</section>)}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-3">
          <div><h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"><MessageCircle className="mr-1 inline size-3.5" /> Send me your song request</h3><p className="mt-1 text-xs text-muted-foreground">Enter your name, song title, and artist. The station will search it and place it in the queue.</p></div>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" maxLength={80} required disabled={submitting} />
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Song title" maxLength={200} required disabled={submitting} />
            <Input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Artist" maxLength={120} required disabled={submitting} />
            {message && <p className={`rounded-lg border px-3 py-2 text-xs ${messageTone === 'error' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-primary/25 bg-primary/5 text-primary'}`} role="status" aria-live="polite">{message}</p>}
            <Button type="submit" disabled={submitting || !name.trim() || !title.trim() || !artist.trim()}>{submitting ? <><Loader2 className="animate-spin" /> Sending…</> : <><Send /> Submit request</>}</Button>
          </form>
        </section>
      </div>
    </SheetContent>
  </Sheet>
}

function TrackRow({ track, rank, badge }: { track: Track; rank?: number; badge?: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/70 px-3 py-2.5"><span className="w-5 shrink-0 text-center font-mono text-xs text-primary">{rank ?? '•'}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{track.title}</p><p className="truncate text-xs text-muted-foreground">{track.artist ?? track.channel ?? 'RJ FM'}{track.era ? ` · ${track.era}` : ''}{track.duration ? ` · ${formatDuration(track.duration)}` : ''}</p></div>{badge && <span className="shrink-0 rounded-full border border-primary/30 px-2 py-1 font-mono text-[9px] text-primary">{badge}</span>}</div>
}
