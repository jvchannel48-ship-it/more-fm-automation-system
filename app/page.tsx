import { AdminMenu } from '@/components/station/admin-menu'
import { RadioPlayer } from '@/components/station/radio-player'
import { NotificationCenter } from '@/components/station/notification-center'
import { MessageButton } from '@/components/station/message-button'
import { SettingsPanel } from '@/components/station/settings-panel'
import { AccountMenu } from '@/components/station/account-menu'
import { StationSelector } from '@/components/station/station-selector'
import { StationShell } from '@/components/station/station-shell'

export default function Home() {
  return (
    <StationShell>
      <header className="radio-header mx-auto flex w-full max-w-3xl items-center justify-end gap-3 px-4 py-5">
        <div className="flex items-center gap-1">
          <StationSelector />
          <NotificationCenter />
          <MessageButton />
          <SettingsPanel />
          <AccountMenu />
          <AdminMenu />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-6">
        <h1 className="sr-only">Live radio player</h1>
        <RadioPlayer />
      </main>
    </StationShell>
  )
}
