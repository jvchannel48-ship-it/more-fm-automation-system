'use client'

import useSWR from 'swr'
import { Clock3, ListMusic } from 'lucide-react'
import { Label } from '@/components/ui/label'

interface TimeCheckItem {
  id: string
  text: string
  createdAt: number
  mode: 'after3' | 'dzmm'
  afterSongNumber: number
  scheduledAt: number | null
}
const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(async (response) => {
  if (!response.ok) throw new Error('Could not load generated time checks.')
  return response.json() as Promise<{ items: TimeCheckItem[] }>
})

export function AdminTimeChecks() {
  const { data } = useSWR('/api/admin/time-checks', fetcher, { refreshInterval: 5000 })
  const items = data?.items ?? []
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
          <Clock3 className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">DJ Christopher · Automatic Time Check</h3>
          <p className="text-xs text-muted-foreground">Short, faster English time checks play immediately after every 2 songs.</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">The live Philippines time (Asia/Manila, UTC+8) is spoken automatically. DJ Christopher may read one random admin-reviewed listener message during the time check, once only. The next song starts as soon as he finishes.</p>
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5"><ListMusic className="size-4" /> Previously queued time checks</Label>
        <span className="text-[11px] text-muted-foreground">{items.length} saved</span>
      </div>
      {items.length > 0 && (
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-background/60 p-2">
          {items.slice().reverse().map((item) => (
            <div key={item.id} className="rounded-md bg-secondary/60 p-2.5">
              <p className="text-xs leading-relaxed text-muted-foreground">{item.text}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
