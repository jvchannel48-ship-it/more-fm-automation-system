'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Home, ChartNoAxesCombined } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { STATIONS, type StationId } from '@/lib/stations'
import { getStoredStation } from './station-selector'
import { AppUpdateGate } from './app-update-gate'
import { AllStationsStatus } from './all-stations-status'

/** Applies station name + background theme (main vs Cebu). */
export function StationShell({ children }: { children: ReactNode }) {
  const [station, setStation] = useState<StationId>('main')

  useEffect(() => {
    setStation(getStoredStation())
    void import('@/lib/app-permissions').then(({ initializePushNotifications }) => initializePushNotifications()).catch((error) => console.warn('[RJ FM] OneSignal initialization failed', error))
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
        console.warn('[RJ FM] Offline support registration failed', error)
      })
    }
  }, [])

  const meta = STATIONS[station]

  return (
    <div className={`radio-app-shell relative flex min-h-dvh flex-col overflow-hidden ${meta.shellClass}`} data-station={station}>
      <div
        className="station-glow pointer-events-none absolute left-1/2 top-1/3 -z-10 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        aria-hidden="true"
      />
      {children}
      <AllStationsStatus />
      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-[90] border-t border-primary/20 bg-background/95 px-5 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 backdrop-blur-xl">
        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3">
          <Button type="button" variant="ghost" className="h-12 flex-col gap-0.5 rounded-xl text-xs" onClick={() => window.dispatchEvent(new Event('morefm:close-all-stations'))}>
            <Home className="size-5" />Home
          </Button>
          <Button type="button" variant="ghost" className="h-12 flex-col gap-0.5 rounded-xl text-xs" onClick={() => window.dispatchEvent(new Event('morefm:open-all-stations'))}>
            <ChartNoAxesCombined className="size-5" />All Station
          </Button>
        </div>
      </nav>
      <AppUpdateGate />
    </div>
  )
}

export function StationBrand() {
  const [station, setStation] = useState<StationId>('main')
  useEffect(() => {
    setStation(getStoredStation())
  }, [])
  const meta = STATIONS[station]
  return (
    <span className="station-mark font-mono text-sm font-bold tracking-[0.28em]">
      {meta.shortName} <span className="text-primary">{meta.frequency}</span>
    </span>
  )
}
