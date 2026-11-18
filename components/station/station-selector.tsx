'use client'

import { useEffect, useState } from 'react'
import { Radio } from 'lucide-react'
import { STATIONS, type StationId, parseStationId } from '@/lib/stations'
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
        <div className="absolute right-0 z-50 mt-1 w-72 overflow-hidden rounded-xl border border-primary/25 bg-card shadow-xl">
          <p className="border-b border-border/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Select station
          </p>
          {(Object.keys(STATIONS) as StationId[]).map((id) => {
            const item = STATIONS[id]
            const active = id === station
            return (
              <button
                key={id}
                type="button"
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-3 text-left transition hover:bg-primary/10 ${active ? 'bg-primary/15' : ''}`}
                onClick={() => select(id)}
              >
                <span className="font-mono text-sm font-semibold tracking-wide">
                  {item.name} <span className="text-primary">{item.frequency}</span>
                  {active && <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-primary">On</span>}
                </span>
                <span className="text-[11px] text-muted-foreground">{item.description}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
