import { AdminMenu } from '@/components/station/admin-menu'
import { RadioPlayer } from '@/components/station/radio-player'

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_20%,rgba(245,183,65,0.12),transparent_32%),linear-gradient(135deg,#090b13_0%,#111827_52%,#0b1220_100%)]">
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4">
        <span className="font-mono text-sm font-bold tracking-widest">
          MOR <span className="text-primary">93.5</span>
        </span>
        <AdminMenu />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-6">
        <h1 className="sr-only">MOR 93.5 Naga livestream</h1>
        <RadioPlayer />
      </main>

      <footer className="mx-auto flex flex-col items-center gap-2 px-4 pb-8 text-center">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/80"><span className="size-1.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" /> On air from Naga</div>
        <p className="text-xs text-muted-foreground">Enjoy the music.</p>
      </footer>
    </div>
  )
}
