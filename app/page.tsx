import { RadioPlayer } from '@/components/station/radio-player'
import { NotificationCenter } from '@/components/station/notification-center'
import { StationShell } from '@/components/station/station-shell'
import { AccountMenu } from '@/components/station/account-menu'
import { BottomNavigation } from '@/components/station/bottom-navigation'

export default function Home() {
  return (
    <StationShell>
      <header className="radio-header mx-auto flex w-full max-w-3xl items-center justify-end gap-3 px-4 py-3">
        <div className="flex items-center gap-1">
          <NotificationCenter />
        </div>
      </header>

      <main id="home-player" className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-2 pb-28">
        <h1 className="sr-only">Live radio player</h1>
        <RadioPlayer />
      </main>
      <div className="mx-auto w-full max-w-3xl px-4 pb-32">
        <RadioBrowser />
      </div>
      <PhRadioMedia />
      <AccountMenu />
      <BottomNavigation />
    </StationShell>
  )
}
