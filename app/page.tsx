import { AdminMenu } from '@/components/station/admin-menu'
import { RadioPlayer } from '@/components/station/radio-player'
import { NotificationCenter } from '@/components/station/notification-center'

export default function Home() {
  return (
    <div className="radio-app-shell relative flex min-h-dvh flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />
      <header className="radio-header mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-5">
        <span className="station-mark font-mono text-sm font-bold tracking-[0.28em]">
          RJ FM <span className="text-primary">93.5</span>
        </span>
        <div className="flex items-center gap-1">
          <NotificationCenter />
          <AdminMenu />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-6">
        <h1 className="sr-only">RJ FM 93.5 livestream</h1>
        <RadioPlayer />
      </main>

    </div>
  )
}
