'use client'

import { ExternalLink, Image as ImageIcon, Radio, Video } from 'lucide-react'

const mediaLinks = [
  {
    title: 'Free radio studio video',
    detail: 'Pexels · 8-second vertical radio broadcast studio clip',
    href: 'https://www.pexels.com/video/radio-station-broadcast-studio-atmosphere-38868674/',
    icon: Video,
  },
  {
    title: 'Free radio studio photos',
    detail: 'Pexels · royalty-free radio studio photo collection',
    href: 'https://www.pexels.com/search/radio%20studio/',
    icon: ImageIcon,
  },
]

export function PhRadioMedia() {
  return (
    <section className="mx-auto mt-5 w-full max-w-3xl space-y-4 px-4 pb-6">
      <div className="rounded-2xl border border-primary/20 bg-card/80 p-4 shadow-lg">
        <div className="mb-3 flex items-center gap-2">
          <Radio className="size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Zeno.FM · Philippine Radio</h2>
            <p className="text-xs text-muted-foreground">Piliin at pakinggan ang mga istasyong Pilipino.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <iframe
            title="PILIPINO FM live radio player"
            src="https://zeno.fm/player/pilipinofm"
            className="h-[190px] w-full"
            loading="lazy"
            allow="autoplay"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted" href="https://zeno.fm/radio/pilipinofm/" target="_blank" rel="noreferrer">
            PILIPINO FM <ExternalLink className="size-3" />
          </a>
          <a className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted" href="https://zeno.fm/radio/countries/Philippines/" target="_blank" rel="noreferrer">
            All Philippine Zeno stations <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-card/80 p-4 shadow-lg">
        <div className="mb-3">
          <h2 className="font-semibold">Free RJ FM Promo Media</h2>
          <p className="text-xs text-muted-foreground">Libreng stock assets para sa radio promos at website visuals.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {mediaLinks.map(({ title, detail, href, icon: Icon }) => (
            <a key={href} href={href} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-xl border border-border bg-background/60 p-3 transition hover:bg-muted">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-sm font-semibold">{title}<ExternalLink className="size-3 shrink-0" /></span>
                <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
              </span>
            </a>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">Pexels photos and videos are free to use under the Pexels License. Open a source to choose and download the original asset before using it in a finished advertisement.</p>
      </div>
    </section>
  )
}
