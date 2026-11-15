'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { ExternalLink, ListMusic, Loader2, Pause, Play, Radio, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RjfmSnapshot } from '@/lib/rjfm-online-radio'

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('RJFM metadata unavailable')
  return response.json() as Promise<RjfmSnapshot>
}

function TrackList({ tracks, showTime = false }: { tracks: RjfmSnapshot['lastPlayed']; showTime?: boolean }) {
  if (!tracks.length) return <p className="text-xs text-muted-foreground">No track metadata available yet.</p>
  return <div className="space-y-2">
    {tracks.map((track, index) => <div key={`${track.title}-${track.artist}-${index}`} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/35 px-3 py-2">
      <span className="w-5 shrink-0 text-center font-mono text-xs text-primary">{index + 1}</span>
      <div className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-semibold">{track.title}</p><p className="truncate text-xs text-muted-foreground">{track.artist}</p></div>
      {showTime && track.playedAt && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{track.playedAt}</span>}
    </div>)}
  </div>
}

export function RjfmStreamPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [streamError, setStreamError] = useState(false)
  const { data, error, mutate, isLoading } = useSWR('/api/rjfm', fetcher, { refreshInterval: 30_000, revalidateOnFocus: true })

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !data) return
    audio.src = data.streamUrl
  }, [data])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio || !data) return
    if (playing) { audio.pause(); setPlaying(false); return }
    setStreamError(false)
    try { await audio.play(); setPlaying(true) } catch { setStreamError(true) }
  }

  return <section aria-label="100.3 RJFM public stream" className="w-full space-y-5">
    <div className="glass-surface rounded-3xl border border-primary/20 p-5 shadow-2xl shadow-primary/10 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-live/40 bg-live/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-live"><span className="size-1.5 animate-pulse rounded-full bg-live" /> {data ? 'Connected' : 'Connecting'}</div><h1 className="text-3xl font-bold tracking-tight">100.3 <span className="text-primary">RJFM</span></h1><p className="mt-1 text-sm text-muted-foreground"><Radio className="mr-1 inline size-3.5" /> Makati, Metro Manila · public stream</p></div>
        <Button size="icon" className="size-14 rounded-full" onClick={() => void toggle()} disabled={!data || isLoading} aria-label={playing ? 'Pause RJFM' : 'Play RJFM'}>{isLoading ? <Loader2 className="animate-spin" /> : playing ? <Pause /> : <Play className="translate-x-0.5" />}</Button>
      </div>
      <audio ref={audioRef} preload="none" onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setStreamError(true); setPlaying(false) }} />
      {(error || streamError) && <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">The public RJFM stream or metadata is temporarily unavailable. Try again shortly.</p>}
      <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground"><span className="rounded-full border border-border px-2.5 py-1">Metadata may lag the audio</span><a className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 hover:border-primary hover:text-primary" href={data?.sourceUrl ?? 'https://onlineradio.ph/40-rjfm-100-3.html'} target="_blank" rel="noreferrer">Source: OnlineRadio.ph <ExternalLink className="size-3" /></a><button className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 hover:border-primary hover:text-primary" onClick={() => void mutate()}><RotateCw className="size-3" /> Refresh</button></div>
    </div>

    {data && <div className="grid gap-4 md:grid-cols-2"><div className="glass-surface rounded-2xl border border-border/70 p-4"><h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><ListMusic className="size-4 text-primary" /> Last played</h2><TrackList tracks={data.lastPlayed} showTime /></div><div className="glass-surface rounded-2xl border border-border/70 p-4"><h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><ListMusic className="size-4 text-primary" /> Top songs</h2><TrackList tracks={data.topSongs} /></div></div>}
  </section>
}
