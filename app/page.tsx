import { AdminMenu } from '@/components/station/admin-menu'
import { getSettings } from '@/lib/storage'

const DOWNLOAD = 'https://midioke-app.vercel.app/download/latest'
const REMOTE = 'https://midioke-app.vercel.app/remote'

export default async function Home() {
  const settings = await getSettings()
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-1/3 -z-10 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4">
        <nav className="flex items-center gap-3 text-sm"><a href="/" className="font-semibold">Home</a><a href="/media" className="text-muted-foreground hover:text-foreground">Media</a></nav>
        <span className="font-mono text-sm font-bold tracking-widest">YS FM <span className="text-primary">107.1</span></span>
        <AdminMenu />
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-6 px-4 py-6">
        <section className="w-full rounded-2xl border border-border bg-card/70 p-5">
          <h2 className="text-xl font-semibold">Station Information</h2>
          <div className="mt-3 grid gap-2 text-sm">
            <p><span className="font-medium">Location:</span> Sta. Cruz, Ratay, Binaliw</p>
            <p><span className="font-medium">Frequency:</span> 107.1 FM <span className="text-muted-foreground">(Unavailable / shutdown)</span></p>
            <p><span className="font-medium">Status:</span> <span className="text-emerald-500">Online streaming available</span></p>
          </div>
        </section>
        <section className="w-full rounded-2xl border border-border bg-card/70 p-5">
          <h2 className="text-xl font-semibold">MidiOke</h2>
          <p className="mt-2 text-sm text-muted-foreground">Collaboration and partnership: YS FM TO MIDIOKE BY Song Space.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a href={DOWNLOAD} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">MidiOke Download Now</a>
            <a href={REMOTE} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold">MidiOke Remote</a>
          </div>
        </section>
        {settings.whatsNew?.trim() && <section className="w-full rounded-2xl border border-border bg-card/70 p-5"><h2 className="text-xl font-semibold">What's New</h2><p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{settings.whatsNew}</p></section>}
      </main>
      <footer className="mx-auto flex flex-col items-center gap-1 px-4 pb-8 text-center">
        <p className="text-sm font-medium">YOUR HOME OF ROMANTIC MUSIC</p>
      </footer>
    </div>
  )
}
