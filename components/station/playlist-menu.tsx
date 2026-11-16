'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ListMusic, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type Track = { id?: string; uid?: string; title: string; artist?: string; channel?: string; duration?: string | number; era?: string; language?: string; startAt?: number; active?: boolean }
type PlaylistData = { name: string; sections: Array<{ id: string; label: string; tracks: Track[] }>; queue: Track[]; fetchedAt: number }

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
  const { data, error, isLoading, mutate } = useSWR<PlaylistData>(open ? '/api/playlist' : null, fetcher, { refreshInterval: 15_000 })

  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger render={<Button variant="outline" size="sm" className="h-9 shrink-0 rounded-full px-2 shadow-sm sm:px-3" aria-label="Open playlist" />}>
      <ListMusic aria-hidden="true" /> <span className="hidden sm:inline">Playlist</span>
    </SheetTrigger>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2"><ListMusic className="size-5 text-primary" /> RJ SONGS</SheetTitle>
        <SheetDescription>Sequential YouTube rotation · 60s · 70s · 80s · 90s · 2000s · 2020s</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4 pb-8">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
          <span>Automatic next song is active. Songs play in order and are blocked from repeating.</span>
          <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => void mutate()} aria-label="Refresh playlist"><RefreshCw className="size-3.5" /></Button>
        </div>
        {isLoading && <p className="text-sm text-muted-foreground">Loading updated playlist…</p>}
        {error && <p className="text-sm text-destructive" role="alert">{error.message}</p>}
        {data?.queue?.length ? <section className="space-y-2"><h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Current / Up next</h3>{data.queue.map((track) => <TrackRow key={track.uid} track={track} badge={track.active ? 'ON AIR' : 'NEXT'} />)}</section> : null}
        {data?.sections.map((section) => <section key={section.id} className="space-y-2"><div className="flex items-center justify-between"><h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{section.label}</h3><span className="text-[10px] text-muted-foreground">{section.tracks.length} songs</span></div>{section.tracks.map((track, index) => <TrackRow key={`${section.id}-${track.id ?? track.title}`} track={track} rank={index + 1} />)}</section>)}
      </div>
    </SheetContent>
  </Sheet>
}

function TrackRow({ track, rank, badge }: { track: Track; rank?: number; badge?: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/70 px-3 py-2.5"><span className="w-5 shrink-0 text-center font-mono text-xs text-primary">{rank ?? '•'}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{track.title}</p><p className="truncate text-xs text-muted-foreground">{track.artist ?? track.channel ?? 'RJ FM'}{track.era ? ` · ${track.era}` : ''}{track.duration ? ` · ${formatDuration(track.duration)}` : ''}</p></div>{badge && <span className="shrink-0 rounded-full border border-primary/30 px-2 py-1 font-mono text-[9px] text-primary">{badge}</span>}</div>
}
