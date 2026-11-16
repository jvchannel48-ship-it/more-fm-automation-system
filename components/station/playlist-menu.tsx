'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ListMusic, RefreshCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type Track = { id?: string; uid?: string; title: string; artist?: string; channel?: string; duration?: string | number; era?: string; language?: string; startAt?: number; active?: boolean }
type PlaylistData = { name: string; sections: Array<{ id: string; label: string; tracks: Track[] }>; queue: Track[]; fetchedAt: number }
type SearchResult = Track & { id: string; url?: string }
type SearchData = { query: string; results: SearchResult[] }

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(async (response) => {
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Playlist unavailable')
  return data
})

function isSearchData(data: PlaylistData | SearchData | undefined): data is SearchData {
  return Boolean(data && 'results' in data)
}

function isPlaylistData(data: PlaylistData | SearchData | undefined): data is PlaylistData {
  return Boolean(data && 'sections' in data && 'queue' in data)
}

function formatDuration(duration?: string | number) {
  if (typeof duration === 'string') return duration
  if (!duration || duration < 1) return ''
  return `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
}

export function PlaylistMenu() {
  const [open, setOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const endpoint = open ? (submittedQuery ? `/api/playlist?q=${encodeURIComponent(submittedQuery)}` : '/api/playlist') : null
  const { data, error, isLoading, mutate } = useSWR<PlaylistData | SearchData>(endpoint, fetcher, { refreshInterval: submittedQuery ? 0 : 15_000 })

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmittedQuery(searchText.trim().slice(0, 120))
  }

  const clearSearch = () => {
    setSearchText('')
    setSubmittedQuery('')
  }

  const closePanel = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) clearSearch()
  }

  return <Sheet open={open} onOpenChange={closePanel}>
    <SheetTrigger render={<Button variant="outline" size="sm" className="h-9 shrink-0 rounded-full px-2 shadow-sm sm:px-3" aria-label="Open playlist" />}>
      <ListMusic aria-hidden="true" /> <span className="hidden sm:inline">Playlist</span>
    </SheetTrigger>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
      <SheetHeader>
      <SheetTitle className="flex items-center gap-2"><ListMusic className="size-5 text-primary" /> YouTube Playlists</SheetTitle>
      <SheetDescription>DITO updates · Saturday–Sunday playlist · Daily playlist</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4 pb-8">
        <form onSubmit={submitSearch} className="flex items-center gap-2" role="search">
          <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search songs or artists" aria-label="Search playlist" className="pl-9" maxLength={120} /></div>
          <Button type="submit" size="sm" disabled={!searchText.trim()}><Search className="size-4 sm:hidden" /><span className="hidden sm:inline">Search</span></Button>
        </form>
        {submittedQuery && <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-3 py-2 text-xs"><span>Search results for <strong>{submittedQuery}</strong></span><Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={clearSearch}><X className="size-3.5" /> Clear</Button></div>}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
          <span>Automatic next song is active. New playlist additions refresh automatically and repeated songs are blocked.</span>
          <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => void mutate()} aria-label="Refresh playlist"><RefreshCw className="size-3.5" /></Button>
        </div>
        {isLoading && <p className="text-sm text-muted-foreground">Loading updated playlist…</p>}
        {error && <p className="text-sm text-destructive" role="alert">{error.message}</p>}
        {isSearchData(data) ? <section className="space-y-2"><div className="flex items-center justify-between"><h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Search results</h3><span className="text-[10px] text-muted-foreground">{data.results.length} songs</span></div>{data.results.map((track, index) => <TrackRow key={track.id} track={track} rank={index + 1} />)}{data.results.length === 0 && <p className="text-sm text-muted-foreground">No playable songs found. Try another title or artist.</p>}</section> : isPlaylistData(data) ? <><div>{data.queue.length > 0 && <section className="space-y-2"><h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Current / Up next</h3>{data.queue.map((track) => <TrackRow key={track.uid} track={track} badge={track.active ? 'ON AIR' : 'NEXT'} />)}</section>}</div>{data.sections.map((section) => <section key={section.id} className="space-y-2"><div className="flex items-center justify-between"><h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{section.label}</h3><span className="text-[10px] text-muted-foreground">{section.tracks.length} songs</span></div>{section.tracks.map((track, index) => <TrackRow key={`${section.id}-${track.id ?? track.title}`} track={track} rank={index + 1} />)}</section>)}</> : null}
      </div>
    </SheetContent>
  </Sheet>
}

function TrackRow({ track, rank, badge }: { track: Track; rank?: number; badge?: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/70 px-3 py-2.5"><span className="w-5 shrink-0 text-center font-mono text-xs text-primary">{rank ?? '•'}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{track.title}</p><p className="truncate text-xs text-muted-foreground">{track.artist ?? track.channel ?? 'RJ FM'}{track.era ? ` · ${track.era}` : ''}{track.duration ? ` · ${formatDuration(track.duration)}` : ''}</p></div>{badge && <span className="shrink-0 rounded-full border border-primary/30 px-2 py-1 font-mono text-[9px] text-primary">{badge}</span>}</div>
}
