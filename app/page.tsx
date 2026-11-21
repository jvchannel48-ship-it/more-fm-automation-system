import { RadioPlayer } from '@/components/station/radio-player'
import { NotificationCenter } from '@/components/station/notification-center'
import { StationSelector } from '@/components/station/station-selector'
import { StationShell } from '@/components/station/station-shell'
import { AccountMenu } from '@/components/station/account-menu'
import { Button } from '@/components/ui/button'
import { Home, ChartNoAxesCombined, UserRound } from 'lucide-react'

export default function HomePage() {
  return (
    <StationShell>
      <header className="radio-header mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Button type="button" variant="ghost" size="sm" className="h-9 gap-1.5 rounded-full border border-primary/25 bg-card/40 px-3 text-xs" onClick={() => window.location.assign('/')}>
          <Home className="size-4" /> Home
        </Button>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-9 gap-1.5 rounded-full border border-primary/25 bg-card/40 px-3 text-xs" onClick={() => window.dispatchEvent(new Event('morefm:open-all-stations'))}>
            <ChartNoAxesCombined className="size-4" /> All Status
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Open profile" className="rounded-full border border-primary/25 bg-card/40" onClick={() => window.dispatchEvent(new Event('morefm:open-account'))}>
            <UserRound className="size-4" />
          </Button>
          <StationSelector />
          <NotificationCenter />
          <AccountMenu />
        </div>
      </header>

      <main id="home-player" className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-2 pb-28">
        <h1 className="sr-only">Live radio player</h1>
        <RadioPlayer />
      </main>
    </StationShell>
  )
}
