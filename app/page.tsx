import { FeedbackForm } from '@/components/station/feedback-form'
import { RadioPlayer } from '@/components/station/radio-player'
import { ThemeToggle } from '@/components/theme-toggle'

export default function Home() {
  return (
    <div className="studio-shell relative flex min-h-dvh flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />
      <header className="glass-surface mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-3xl items-center justify-between gap-3 rounded-2xl px-4 py-3 sm:mt-5">
        <div className="flex items-center gap-3">
          <div className="size-16 overflow-hidden rounded-full border border-primary/60 bg-card p-1 shadow-lg shadow-primary/10 sm:size-20">
            <img src="/rj-fm-logo.jpg" alt="RJ FM station logo" className="size-full rounded-full object-cover" />
          </div>
          <span className="font-mono text-sm font-bold tracking-widest">
            RJ <span className="text-primary">FM</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <FeedbackForm />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-8">
        <h1 className="sr-only">RJ FM livestream</h1>
        <RadioPlayer />
      </main>

      <footer className="mx-auto flex flex-col items-center gap-2 px-4 pb-8 text-center">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-success"><span className="size-1.5 rounded-full bg-success shadow-[0_0_12px_var(--success)]" /> On air from Naga</div>
      </footer>
    </div>
  )
}
