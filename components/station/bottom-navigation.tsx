'use client'

import { Compass, Home, Gauge, Settings } from 'lucide-react'

export type AppTab = 'home' | 'discover' | 'usage' | 'settings'

export function BottomNavigation({ activeTab, onTabChange }: { activeTab: AppTab; onTabChange: (tab: AppTab) => void }) {
  const tabs: { id: AppTab; label: string; icon: typeof Home }[] = [
    { id: 'home', label: 'HOME', icon: Home },
    { id: 'discover', label: 'DISCOVER MORE', icon: Compass },
    { id: 'usage', label: 'DATA USAGE', icon: Gauge },
    { id: 'settings', label: 'SETTINGS', icon: Settings },
  ]

  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-[#091522]/95 px-4 pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-2 shadow-[0_-12px_35px_rgba(0,0,0,.38)] backdrop-blur-xl">
      <div className="mx-auto mb-2 flex max-w-md items-center justify-center gap-2 text-[10px] font-extrabold tracking-[0.24em] text-rose-200"><span className="size-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,.95)]" aria-hidden="true" /> LIVE NOW</div>
      <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-2">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onTabChange(id)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border text-[10px] font-extrabold tracking-[0.16em] transition ${active ? 'border-cyan-200/35 bg-cyan-300/15 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_0_22px_rgba(34,211,238,.1)]' : 'border-transparent bg-white/[0.035] text-slate-400 hover:bg-white/[0.07]'}`}
            >
              <Icon className="size-5" />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
