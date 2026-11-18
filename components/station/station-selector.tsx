'use client'

import { useEffect, useState } from 'react'
import { Check, Radio } from 'lucide-react'
import { STATIONS, STATION_ORDER, type StationId, parseStationId } from '@/lib/stations'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'morefm_selected_station'

export function getStoredStation(): StationId {
  if (typeof window === 'undefined') return 'main'
  try {
    return parseStationId(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'main'
  }
}

export function StationSelector() {
  const [station, setStation] = useState<StationId>('main')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setStation(getStoredStation())
  }, [])

  const select = (next: StationId) => {
    setStation(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
    setOpen(false)
    window.location.reload()
  }

  const current = STATIONS[station]

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 gap-1.5 px-2 font-mono text-[11px] tracking-wide"
        aria-label="Select station"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Radio className="size-3.5 text-primary" aria-hidden="true" />
        <span className="max-w-[11rem] truncate">
          {current.shortName} <span className="text-primary">{current.frequency}</span>
        </span>
      </Button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default bg-black/40" aria-label="Close station list" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-primary/30 bg-card/95 shadow-2xl shadow-black/50 backdrop-blur-md">
            <div className="border-b border-border/60 bg-primary/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Select station</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Regional RJ FM feeds · different playlists & schedules</p>
            </div>
            <div className="max-h-[min(24rem,70vh)] overflow-y-auto p-2">
              {STATION_ORDER.map((id) => {
                const item = STATIONS[id]
                const active = id === station
                return (
                  <button
                    key={id}
                    type="button"
                    className={`mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition last:mb-0 ${
                      active ? 'bg-primary/15 ring-1 ring-primary/35' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => select(id)}
                  >
                    <span className={`mt-0.5 flex size-10 shrink-0 flex-col items-center justify-center rounded-lg font-mono text-[10px] font-bold leading-tight ${
                      active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                    }`}>
                      <span className="text-[9px] opacity-80">FM</span>
                      <span>{item.frequency}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold tracking-wide">{item.name}</span>
                        {active && <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.city} · {item.description}</span>
                      <span className="mt-1 block text-[10px] uppercase tracking-wider text-primary/80">{item.modeLabel}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
