'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RadioTower, Search, Play, Radio, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { STATIONS, STATION_ORDER, type StationId, parseStationId } from '@/lib/stations'

type DirectoryStation = {
  stationuuid: string
  name: string
  url_resolved: string
  favicon: string
  country: string
  tags: string
  bitrate: number
}
const STORAGE_KEY = 'morefm_selected_station'

export function AllStationsStatus() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'discover' | 'search'>('discover')
  const [query, setQuery] = useState('')
  const [stations, setStations] = useState<DirectoryStation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<StationId>('main')

  const loadStations = useCallback(async (term = '') => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/radio-browser?q=${encodeURIComponent(term)}`, { cache: 'no-store' })
      const result = await response.json() as { stations?: DirectoryStation[]; error?: string }
      if (!response.ok) throw new Error(result.error || 'Hindi ma-load ang radio stations.')
      setStations(result.stations ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hindi ma-load ang radio stations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    try { setSelected(parseStationId(window.localStorage.getItem(STORAGE_KEY))) } catch { setSelected('main') }
    const show = () => {
      setOpen(true)
      void loadStations('')
    }
    window.addEventListener('morefm:open-all-stations', show)
    return () => window.removeEventListener('morefm:open-all-stations', show)
  }, [loadStations])

  const playExternal = (station: DirectoryStation) => {
    window.dispatchEvent(new CustomEvent('morefm:play-external-station', { detail: station }))
    setOpen(false)
  }
  const chooseRj = (id: StationId) => {
    try { window.localStorage.setItem(STORAGE_KEY, id) } catch { /* ignore */ }
    window.location.reload()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-background/95 px-3 pb-24 pt-5 backdrop-blur-xl sm:px-5">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary"><RadioTower className="size-6" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">RJ FM · Philippine Radio</p><h2 className="text-xl font-bold">All Station Discover</h2></div>
          </div>
          <Button variant="outline" size="icon" onClick={() => setOpen(false)} aria-label="Close Discover"><ArrowLeft className="size-5" /></Button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-1">
          <button type="button" onClick={() => setTab('discover')} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${tab === 'discover' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>Discover</button>
          <button type="button" onClick={() => setTab('search')} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${tab === 'search' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>Search</button>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-card p-4">
          <div className="mb-2 flex items-center gap-2"><Radio className="size-4 text-primary" /><h3 className="font-semibold">RJ FM Stations</h3></div>
          <p className="mb-3 text-xs text-muted-foreground">Piliin kung aling RJ FM station ang gagamitin ng main player.</p>
          <select aria-label="Select RJ FM station" value={selected} onChange={(event) => chooseRj(parseStationId(event.target.value))} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
            {STATION_ORDER.map((id) => <option key={id} value={id}>{STATIONS[id].name} · {STATIONS[id].frequency} FM · {STATIONS[id].city}</option>)}
          </select>
        </div>

        {tab === 'search' && (
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void loadStations(query.trim()) }}>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Philippine radio station…" aria-label="Search Philippine radio stations" />
            <Button type="submit" size="icon" aria-label="Search stations" disabled={loading}><Search className="size-4" /></Button>
          </form>
        )}

        {tab === 'discover' && (
          <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Philippine stations</h3><Button type="button" variant="outline" size="sm" onClick={() => void loadStations('')} disabled={loading}>Refresh</Button></div>
        )}
        {tab === 'search' && <h3 className="font-semibold">Search results</h3>}
        {loading && <p className="text-xs text-muted-foreground">Loading Philippine stations…</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!loading && stations.length === 0 && !error && <p className="text-sm text-muted-foreground">Walang nahanap na station.</p>}
        <div className="flex flex-col gap-2">
          {stations.map((station) => (
            <div key={station.stationuuid} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
                {station.favicon ? <img src={station.favicon} alt="" className="size-full object-contain" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <Radio className="size-4 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{station.name}</p><p className="truncate text-[11px] text-muted-foreground">{station.country} · {station.tags.split(',').slice(0, 2).join(', ') || 'Radio'}</p></div>
              <Button type="button" size="icon" onClick={() => playExternal(station)} aria-label={`Play ${station.name}`}><Play className="size-4" /></Button>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Zeno.FM Philippines</p>
          <p className="mt-1 text-xs text-muted-foreground">Browse Filipino stations and public Zeno.FM streams.</p>
          <a className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary underline" href="https://zeno.fm/radio/countries/Philippines/" target="_blank" rel="noreferrer">Open Zeno Philippine directory <ExternalLink className="size-3" /></a>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">Radio Browser directory · Philippines only. Some station streams may be offline or may block playback in certain browsers.</p>
      </div>
    </div>
  )
}
