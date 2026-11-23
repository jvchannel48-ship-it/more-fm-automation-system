'use client'

import { useState } from 'react'
import { UsageDashboard } from '@/components/station/usage-dashboard'
import { Radio, MapPin } from 'lucide-react'
import { RadioPlayer } from '@/components/station/radio-player'
import { NotificationCenter } from '@/components/station/notification-center'
import { StationShell } from '@/components/station/station-shell'
import { BottomNavigation, type AppTab } from '@/components/station/bottom-navigation'
import { STATIONS, STATION_ORDER } from '@/lib/stations'
import { SettingsPanel } from '@/components/station/settings-panel'

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>('home')

  return (
    <StationShell>
      <header className="radio-header mx-auto flex w-full max-w-3xl items-center justify-end gap-3 px-4 py-3">
        <NotificationCenter />
      </header>

      {/* Keep the player mounted while Discover is open so audio does not stop. */}
      <main id="home-player" hidden={activeTab !== 'home'} className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-2 pb-28">
          <h1 className="sr-only">RJ FM Home live radio player</h1>
          <RadioPlayer />
        </main>
      <main id="discover-more" hidden={activeTab !== 'discover'} className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 pb-28 pt-3">
          <section className="overflow-visible rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#102b3d]/95 via-[#101d31]/95 to-[#251633]/95 p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-200">
                <Radio className="size-6" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-200">Discover More</p>
                <h1 className="text-xl font-black tracking-wide text-white">RJ FM NATIONWIDE</h1>
                <p className="text-xs text-slate-300">Listen to RJ FM stations nationwide.</p>
              </div>
            </div>

          </section>

          <section className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold tracking-wide text-white">RJ FM STATIONS</h2>
                <p className="text-xs text-muted-foreground">Choose a station to return to Home and start playing automatically.</p>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary">{STATION_ORDER.length} STATIONS</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {STATION_ORDER.map((id) => {
                const item = STATIONS[id]
                return (
                  <button key={id} type="button" onClick={() => { try { window.localStorage.setItem('morefm_selected_station', id) } catch { /* storage may be unavailable */ } window.dispatchEvent(new CustomEvent('morefm:select-station', { detail: id })); setActiveTab('home') }} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-left shadow-lg transition hover:border-cyan-200/40 hover:bg-slate-900/80 active:scale-[.99]">
                    <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border border-cyan-200/20 bg-cyan-300/10 font-mono text-cyan-100">
                      <span className="text-[8px] font-bold tracking-widest">FM</span>
                      <span className="text-sm font-black">{item.frequency}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-white">{item.name}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400"><MapPin className="size-3" />{item.city}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </main>
      {activeTab === 'usage' && <UsageDashboard />}
      {activeTab === 'settings' && <SettingsPanel embedded />}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </StationShell>
  )
}
