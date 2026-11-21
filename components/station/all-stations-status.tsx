'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { ArrowLeft, RadioTower, Users, Trophy, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StationStatus {
  id: string
  name: string
  frequency: string
  listenersNow: number
  currentSong: string
  averageListeners24h: number
  samples24h: number
  status: string
  rjfmRank: number
}
interface StatusResponse {
  updatedAt: number
  totalListenersNow: number
  totalAverageListeners24h: number
  rankingScope: string
  stations: StationStatus[]
}
const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => {
  if (!r.ok) throw new Error('Could not load station status')
  return r.json() as Promise<StatusResponse>
})

export function AllStationsStatus() {
  const [open, setOpen] = useState(false)
  const { data, error } = useSWR('/api/station-status', fetcher, { refreshInterval: 15000, revalidateOnFocus: true })
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener('morefm:open-all-stations', show)
    return () => window.removeEventListener('morefm:open-all-stations', show)
  }, [])
  if (!open) return null
  const ranked = data?.stations.filter((station) => station.samples24h > 0).sort((a, b) => a.rjfmRank - b.rjfmRank) ?? []
  const leader = ranked[0]
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-background/95 px-3 pb-24 pt-5 backdrop-blur-xl sm:px-5">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary"><RadioTower className="size-6" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">RJ FM Network</p><h2 className="text-xl font-bold">All Station Status</h2></div>
          </div>
          <Button variant="outline" size="icon" onClick={() => setOpen(false)} aria-label="Close All Station Status"><ArrowLeft className="size-5" /></Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-primary/20 bg-card p-4"><Users className="mb-2 size-5 text-primary" /><p className="text-2xl font-bold tabular-nums">{data?.totalListenersNow ?? '—'}</p><p className="text-xs text-muted-foreground">Listeners now · network</p></div>
          <div className="rounded-2xl border border-primary/20 bg-card p-4"><Activity className="mb-2 size-5 text-primary" /><p className="text-2xl font-bold tabular-nums">{data?.totalAverageListeners24h ?? '—'}</p><p className="text-xs text-muted-foreground">Average listeners · 24 hours</p></div>
        </div>
        <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card p-4">
          <div className="flex items-center gap-2 text-primary"><Trophy className="size-5" /><span className="text-xs font-bold uppercase tracking-widest">RJ FM Network Leader</span></div>
          {leader ? <><p className="mt-2 text-2xl font-bold">#1 · {leader.name}</p><p className="mt-1 text-sm text-muted-foreground">{leader.averageListeners24h.toLocaleString()} average listeners · measured 24-hour average</p></> : <p className="mt-2 text-sm text-muted-foreground">Collecting listener data. Ranking will appear after verified listening samples arrive.</p>}
          <p className="mt-2 text-[11px] text-muted-foreground">This is an internal RJ FM station comparison, not an official national FM radio chart.</p>
        </div>
        <div className="flex items-center justify-between"><h3 className="font-semibold">Station performance</h3><span className="text-[11px] text-muted-foreground">Auto-refresh · 15 sec</span></div>
        {error && <p role="alert" className="text-sm text-destructive">Status is temporarily unavailable. Retrying…</p>}
        <div className="flex flex-col gap-2">
          {data?.stations.map((station) => (
            <div key={station.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0"><p className="truncate font-semibold">{station.name}</p><p className="text-xs text-muted-foreground">{station.frequency} MHz</p></div>
                <span className={station.status === 'LIVE' ? 'rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-400' : 'rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground'}>{station.status}</span>
              </div>
              <p className="mt-2 truncate text-xs text-muted-foreground" title={station.currentSong}>Now playing: <span className="font-medium text-foreground">{station.currentSong}</span></p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div><p className="text-lg font-bold tabular-nums">{station.listenersNow}</p><p className="text-[10px] text-muted-foreground">Listening now</p></div>
                <div><p className="text-lg font-bold tabular-nums">{station.averageListeners24h}</p><p className="text-[10px] text-muted-foreground">24h average</p></div>
                <div><p className="text-lg font-bold tabular-nums">{station.samples24h ? `#${station.rjfmRank}` : '—'}</p><p className="text-[10px] text-muted-foreground">RJ FM rank</p></div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-[11px] text-muted-foreground">Only anonymized player heartbeats are counted. Rankings are based on actual recorded listener activity; no song-title or audio-content monitoring is displayed.</p>
      </div>
    </div>
  )
}
