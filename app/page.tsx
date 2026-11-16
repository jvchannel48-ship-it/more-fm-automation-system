import { FeedbackForm } from '@/components/station/feedback-form'
import { AdminMenu } from '@/components/station/admin-menu'
import { PlaylistMenu } from '@/components/station/playlist-menu'
import { RadioPlayer } from '@/components/station/radio-player'
import { ThemeToggle } from '@/components/theme-toggle'

export default function Home() {
  return (
    <div className="studio-shell relative flex min-h-dvh flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />
      <header className="glass-surface mx-auto mt-3 flex w-[calc(100%-1rem)] max-w-3xl flex-wrap items-center justify-between gap-2 rounded-2xl px-2.5 py-2.5 sm:mt-5 sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="size-12 shrink-0 overflow-hidden rounded-full border border-primary/60 bg-[#0b1220] p-1 shadow-lg shadow-primary/10 sm:size-20">
            <img src="/rj-fm-bicol-logo.jpg" alt="RJ FM — No. 1 Bicol Region" className="size-full rounded-full object-cover" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-mono text-xs font-bold tracking-widest sm:text-sm">RJ <span className="text-primary">FM</span></span>
            <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-amber-300 sm:text-[9px] sm:tracking-[0.16em]">No. 1 Bicol Region</span>
          </div>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <PlaylistMenu />
          <FeedbackForm />
          <AdminMenu />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-8">
        <h1 className="sr-only">RJ FM radio</h1>
        <RadioPlayer />
      </main>

      <div className="h-8" aria-hidden="true" />
    </div>
  )
}
