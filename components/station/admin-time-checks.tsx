'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Clock3, ListMusic, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const { data, mutate } = useSWR('/api/admin/time-checks', fetcher, { refreshInterval: 5000 })
  const [prompt, setPrompt] = useState('Generate RJ FM time check is 4:30 AM')
  const [mode, setMode] = useState<'after3' | 'dzmm'>('after3')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const generate = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/admin/time-checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode }),
      })
      const result = await response.json() as { error?: string; items?: TimeCheckItem[] }
      if (!response.ok) throw new Error(result.error ?? 'Could not generate time check.')
      await mutate({ items: result.items ?? [] }, { revalidate: false })
      setMessage(mode === 'dzmm'
        ? 'Time check saved. It will play before the scheduled 6:30 PM DZMM handoff.'
        : 'Time check saved in sequence. It will play after the next 3 songs.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not generate time check.')
    } finally {
      setBusy(false)
    }
  }

  const items = data?.items ?? []
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
          <Clock3 className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">DJ Christopher · Generate Time Check</h3>
          <p className="text-xs text-muted-foreground">Generate and save voice clips; queued clips play automatically in order.</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="christopher-time-prompt">Time-check prompt</Label>
        <input
          id="christopher-time-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Generate RJ FM time check is 4:30 AM"
          maxLength={180}
          disabled={busy}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="christopher-time-mode">Playback schedule</Label>
        <select
          id="christopher-time-mode"
          value={mode}
          onChange={(event) => setMode(event.target.value as 'after3' | 'dzmm')}
          disabled={busy}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="after3">After 3 songs · sequential queue</option>
          <option value="dzmm">Before DZMM · 6:29 PM handoff</option>
        </select>
      </div>
      <Button type="button" onClick={generate} disabled={busy || !prompt.trim()}>
        <WandSparkles className="size-4" />
        {busy ? 'Generating…' : 'Generate and queue time check'}
      </Button>
      {message && <p className="text-xs text-emerald-300" role="status">{message}</p>}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5"><ListMusic className="size-4" /> Generated time checks</Label>
        <span className="text-[11px] text-muted-foreground">{items.length} saved</span>
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-background/60 p-2">
        {items.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No generated time checks yet.</p>
        ) : items.slice().reverse().map((item) => (
          <div key={item.id} className="rounded-md bg-secondary/60 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold">{item.mode === 'dzmm' ? 'Before DZMM · 6:29 PM' : `After song #${item.afterSongNumber}`}</span>
              <span className={item.scheduledAt ? 'text-[10px] text-emerald-300' : 'text-[10px] text-amber-300'}>
                {item.scheduledAt ? 'Scheduled to play' : 'Waiting in queue'}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
