'use client'

import { Home as HomeIcon, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BottomNavigation() {
  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/20 bg-background/95 px-2 pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-1">
        <Button type="button" variant="ghost" className="h-14 flex-col gap-1 rounded-xl px-1 text-[11px] focus-visible:border-transparent focus-visible:ring-0" onClick={() => document.getElementById('home-player')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><HomeIcon className="size-5" />Home</Button>
        <Button type="button" variant="ghost" className="h-14 flex-col gap-1 rounded-xl px-1 text-[11px] focus-visible:border-transparent focus-visible:ring-0" onClick={() => window.dispatchEvent(new Event('morefm:open-all-stations'))}><Compass className="size-5" />Discover</Button>
      </div>
    </nav>
  )
}
