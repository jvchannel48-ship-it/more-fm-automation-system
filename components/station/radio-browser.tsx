'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Pause, Play, Radio, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type RadioStation = {
  stationuuid: string
  name: string
  url_resolved: string
  favicon: string
  country: string
  tags: string
  bitrate: number
  codec: string
}

export function RadioBrowser() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [query, setQuery] = useState('')
  const [stations, setStations] = useState<RadioStation[]>([])
  const [active, setActive] = useState<RadioStation | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = useCallback(async (term = '') => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/radio-browser?q=${encodeURIComponent(term)}`, { cache: 'no-store' })
      const result = await response.json() as { stations?: RadioStation[]; error?: string }
      if (!response.ok) throw new Error(result.error || 'Hindi ma-load ang radio directory.')
      setStations(result.stations ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hindi ma-load ang radio directory.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void search('') }, [search])

  const playStation = (station: RadioStation) => {
    const audio = audioRef.current
    if (!audio) return
    if (active?.stationuuid === station.stationuuid && playing) {
      audio.pause()
      setPlaying(false)
      return
    }
    setActive(station)
    audio.src = station.url_resolved
    audio.play().then(() => setPlaying(true)).catch(() => {
      setPlaying(false)
      setError('Hindi ma-play ang station stream. Subukan ang ibang station.')
    })
  }

  return (
    <section className="w-full rounded-2xl border border-primary/20 bg-card/80 p-4 text-left shadow-lg">
      <div className="mb-3 flex items-center gap-2">
        <Radio className="size-5 text-primary" />
        <div>
          <h2 className="font-semibold">Radio Browser</h2>
          <p className="text-xs text-muted-foreground">Maghanap ng online radio stations sa buong mundo.</p>
        </div>
      </div>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void search(query.trim()) }}>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search station, country, genre…" aria-label="Search radio stations" />
        <Button type="submit" size="icon" aria-label="Search stations" disabled={loading}><Search className="size-4" /></Button>
      </form>
      {active && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Selected station</p>
            <p className="truncate text-sm font-semibold">{active.name}</p>
            <p className="truncate text-xs text-muted-foreground">{active.country || 'Online'} · {active.bitrate || '—'} kbps</p>
          </div>
          <Button type="button" size="icon" variant="secondary" onClick={() => {
            if (!audioRef.current) return
            if (playing) { audioRef.current.pause(); setPlaying(false) }
            else { audioRef.current.play().then(() => setPlaying(true)).catch(() => setError('Hindi ma-play ang station stream.')) }
          }} aria-label={playing ? 'Pause selected station' : 'Play selected station'}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
        </div>
      )}
      {loading && <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Loading stations…</p>}
      {error && <p className="mt-3 text-xs text-destructive" role="alert">{error}</p>}
      {!loading && stations.length === 0 && !error && <p className="mt-3 text-xs text-muted-foreground">Walang nahanap na station.</p>}
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
        {stations.map((station) => (
          <div key={station.stationuuid} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/50 p-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
              {station.favicon ? <img src={station.favicon} alt="" className="size-full object-contain" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <Radio className="size-4 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{station.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{[station.country, station.tags.split(',').slice(0, 2).join(', ')].filter(Boolean).join(' · ') || 'Online radio'}</p>
            </div>
            <Button type="button" size="icon" variant={active?.stationuuid === station.stationuuid && playing ? 'default' : 'outline'} onClick={() => playStation(station)} aria-label={active?.stationuuid === station.stationuuid && playing ? `Pause ${station.name}` : `Play ${station.name}`}>
              {active?.stationuuid === station.stationuuid && playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">Directory powered by Radio Browser. Availability and stream quality depend on each station.</p>
      <audio ref={audioRef} className="hidden" onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
    </section>
  )
}
