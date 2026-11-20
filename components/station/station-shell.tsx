'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { STATIONS, type StationId } from '@/lib/stations'
import { getStoredStation } from './station-selector'
import { AppUpdateGate } from './app-update-gate'

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
