'use client'

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { Loader2, Pause, Play, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBroadcast } from '@/hooks/use-broadcast'
import type { NowResponse } from '@/lib/types'

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((response) => {
  if (!response.ok) throw new Error('RJ FM player test is unavailable.')
  return response.json() as Promise<NowResponse>
})

/** Admin-only live player test, separate from the public listener player. */
export function AdminPlayerTest() {
  const [playing, setPlaying] = useState(false)
  const { data, error, mutate } = useSWR('/api/now?station=main', fetcher, {
    refreshInterval: playing ? 5000 : 15000,
    revalidateOnFocus: true,
  })
  const recover = useCallback((uid: string) => {
    void fetch('/api/now?station=main', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
      cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok) throw new Error('Could not recover test stream.')
      return response.json() as Promise<NowResponse>
    }).then((next) => mutate(next, { revalidate: false })).catch(() => mutate())
  }, [mutate])
  const { buffering, playbackIssue, unlock } = useBroadcast(data, playing, 1, recover, 'main')
  const toggle = () => {
    if (!playing) unlock()
    setPlaying((current) => !current)
  }
  const currentTrack = data?.tracks
    .filter((track) => track.kind === 'music' && track.startAt <= (data.serverTime ?? Date.now()) && track.startAt + track.duration * 1000 > (data.serverTime ?? Date.now()))
    .sort((a, b) => b.startAt - a.startAt)[0]

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-sky-400/25 bg-gradient-to-br from-sky-400/10 via-secondary/40 to-card p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-10 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300">
          <Radio className="size-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">RJ FM 93.5 · Player Test</h3>
          <p className="text-xs text-muted-foreground">Test the live player and audio stream directly from Admin Panel.</p>
        </div>
      </div>
      <Button type="button" onClick={toggle} className="h-16 w-full gap-3 text-base font-bold shadow-lg" variant={playing ? 'destructive' : 'default'}>
        {playing ? <Pause className="size-7" /> : <Play className="size-7 fill-current" />}
        {playing ? 'STOP PLAYER TEST' : 'PLAY PLAYER TEST'}
      </Button>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{playing ? (buffering ? 'Connecting / buffering…' : 'Test player is running') : 'Player test is stopped'}</span>
        {playing && <span className="inline-flex items-center gap-1.5 text-emerald-300"><span className="size-2 animate-pulse rounded-full bg-emerald-400" /> ON</span>}
      </div>
      {currentTrack && <p className="truncate text-xs text-muted-foreground">Now: {currentTrack.title} · {currentTrack.artist}</p>}
      {data?.offAir && <p className="text-xs text-amber-300">RJ FM is currently off-air according to its schedule.</p>}
      {error && <p className="text-xs text-destructive" role="alert">{error.message}</p>}
      {playbackIssue && <p className="text-xs text-amber-200" role="status">{playbackIssue}</p>}
      {buffering && playing && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Connecting to RJ FM…</p>}
    </section>
  )
}
