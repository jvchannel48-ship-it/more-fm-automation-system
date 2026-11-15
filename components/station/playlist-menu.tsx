'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { ListMusic, Loader2, Menu, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type Track = { id?: string; uid?: string; title: string; artist?: string; channel?: string; duration?: string | number; era?: string; language?: string; startAt?: number; active?: boolean; url?: string }
type PlaylistData = { name: string; sections: Array<{ id: string; label: string; tracks: Track[] }>; queue: Track[]; fetchedAt: number }
type SearchData = { query: string; results: Track[] }

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
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchData, setSearchData] = useState<SearchData | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const { data, error, mutate } = useSWR<PlaylistData>(open ? '/api/playlist' : null, fetcher, { refreshInterval: 15_000 })

  useEffect(() => {
    if (!open) { setQuery(''); setSearchData(null); setMessage('') }
  }, [open])

  const search = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = query.trim()
    if (!value) return
    setSearching(true); setMessage('')
    try {
      const response = await fetch(`/api/playlist?q=${encodeURIComponent(value)}`, { cache: 'no-store' })
      const result = await response.json() as SearchData & { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Search failed')
      setSearchData(result)
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Search failed. Try again.') }
    finally { setSearching(false) }
  }

  const add = async (track: Track) => {
    const key = track.id ?? track.title
    setAdding(key); setMessage('')
    try {
      const response = await fetch('/api/playlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: track.title, artist: track.artist ?? track.channel ?? 'YouTube artist' }) })
      const result = await response.json() as { queued?: boolean; reason?: string; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'The song could not be added.')
      setMessage(result.queued ? `${track.title} added to RJ SONGS.` : (result.reason ?? 'Saved for the next playlist fill.'))
      await mutate()
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'The song could not be added.') }
    finally { setAdding(null) }
  }

  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger render={<Button variant="outline" size="sm" aria-label="Open RJ Songs playlist" />}><ListMusic aria-hidden="true" /> Playlist</SheetTrigger>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
      <SheetHeader><SheetTitle className="flex items-center gap-2"><ListMusic className="size-5 text-primary" /> RJ SONGS</SheetTitle><SheetDescription>Own sequential playlist · YouTube public search · no API key</SheetDescription></SheetHeader>
      <div className="flex flex-col gap-5 px-4 pb-8">
        <form onSubmit={search} className="flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the next song…" aria-label="Search songs" /><Button type="submit" size="icon" disabled={searching || !query.trim()} aria-label="Search">{searching ? <Loader2 className="animate-spin" /> : <Search />}</Button></form>
        {message && <p className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-primary" role="status">{message}</p>}
        {searchData && <section className="space-y-2"><h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Search results</h3>{searchData.results.length ? searchData.results.map((track) => <TrackRow key={track.id ?? track.title} track={track} action={<Button size="sm" variant="outline" onClick={() => void add(track)} disabled={adding === (track.id ?? track.title)}>{adding === (track.id ?? track.title) ? <Loader2 className="animate-spin" /> : <Plus />} Add</Button>} />) : <p className="text-xs text-muted-foreground">No matching public YouTube results.</p>}</section>}
        {error && <p className="text-sm text-destructive" role="alert">{error.message}</p>}
        {data?.queue?.length ? <section className="space-y-2"><h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Up next</h3>{data.queue.map((track) => <TrackRow key={track.uid} track={track} badge={track.active ? 'ON AIR' : 'QUEUED'} />)}</section> : null}
        {data?.sections.map((section) => <section key={section.id} className="space-y-2"><div className="flex items-center justify-between"><h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{section.label}</h3><span className="text-[10px] text-muted-foreground">{section.tracks.length} songs</span></div>{section.tracks.slice(0, 12).map((track, index) => <TrackRow key={`${section.id}-${track.id ?? track.title}`} track={track} rank={index + 1} />)}</section>)}
      </div>
    </SheetContent>
  </Sheet>
}

function TrackRow({ track, rank, badge, action }: { track: Track; rank?: number; badge?: string; action?: React.ReactNode }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/70 px-3 py-2.5"><span className="w-5 shrink-0 text-center font-mono text-xs text-primary">{rank ?? (badge ? '•' : '')}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{track.title}</p><p className="truncate text-xs text-muted-foreground">{track.artist ?? track.channel ?? 'RJ FM'}{track.era ? ` · ${track.era}` : ''}{track.duration ? ` · ${formatDuration(track.duration)}` : ''}</p></div>{badge && <span className="shrink-0 rounded-full border border-primary/30 px-2 py-1 font-mono text-[9px] text-primary">{badge}</span>}{action}
  </div>
}
