import { AdminMenu } from '@/components/station/admin-menu'
import { RadioPlayer } from '@/components/station/radio-player'
import { NotificationCenter } from '@/components/station/notification-center'
import { StationSelector } from '@/components/station/station-selector'
import { StationShell } from '@/components/station/station-shell'
import { Home as HomeIcon, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccountMenu } from '@/components/station/account-menu'

export default function Home() {
  return (
    <StationShell>
      <header className="radio-header mx-auto flex w-full max-w-3xl items-center justify-end gap-3 px-4 py-5">
        <div className="flex items-center gap-1">
          <StationSelector />
          <NotificationCenter />
        </div>
      </header>

      <main id="home-player" className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-6 pb-28">
        <h1 className="sr-only">Live radio player</h1>
        <RadioPlayer />
      </main>
      <AccountMenu />
      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/20 bg-background/95 px-3 pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto grid w-full max-w-3xl grid-cols-3 gap-2">
          <Button type="button" variant="ghost" className="h-14 flex-col gap-1 rounded-xl text-xs" onClick={() => document.getElementById('home-player')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><HomeIcon className="size-5" />Home</Button>
          <Button type="button" variant="ghost" className="h-14 flex-col gap-1 rounded-xl text-xs" onClick={() => window.dispatchEvent(new Event('morefm:open-settings'))}><Settings className="size-5" />Settings</Button>
          <AdminMenu />
        </div>
      </nav>
    </StationShell>
  )
}
