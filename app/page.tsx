import { RadioPlayer } from '@/components/station/radio-player'
import { NotificationCenter } from '@/components/station/notification-center'
import { StationSelector } from '@/components/station/station-selector'
import { StationShell } from '@/components/station/station-shell'
import { AccountMenu } from '@/components/station/account-menu'
import { BottomNavigation } from '@/components/station/bottom-navigation'
import { PublicVpnPanel } from '@/components/station/public-vpn-panel'

export default function Home() {
  return (
    <StationShell>
      <header className="radio-header mx-auto flex w-full max-w-3xl items-center justify-end gap-3 px-4 py-3">
        <div className="flex items-center gap-1">
          <StationSelector />
          <NotificationCenter />
        </div>
      </header>

      <main id="home-player" className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-2 pb-28">
        <h1 className="sr-only">Live radio player</h1>
        <RadioPlayer />
        <div className="mt-5 w-full"><PublicVpnPanel /></div>
      </main>
      <AccountMenu />
      <BottomNavigation />
    </StationShell>
  )
}
