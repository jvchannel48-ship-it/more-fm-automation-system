'use client'

import useSWR from 'swr'
import { Check, Clock3, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SongRequest } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((response) => response.json() as Promise<{ requests: SongRequest[] }>)

export function RequestInbox() {
  const { data, mutate } = useSWR('/api/admin/requests', fetcher, { refreshInterval: 15000 })
  const update = async (id: string, status: 'played' | 'skipped') => {
    await fetch('/api/admin/requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    mutate()
  }
  const pending = data?.requests?.filter((request) => request.status === 'pending') ?? []
  return <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
    <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Song requests</h3><p className="text-xs text-muted-foreground">Mga request na susuriin at isasama sa music rotation kapag available.</p></div><Clock3 className="size-4 text-primary" aria-hidden="true" /></div>
    {pending.length === 0 ? <p className="text-xs text-muted-foreground">Wala pang pending requests.</p> : <div className="flex flex-col gap-2">{pending.slice(0, 8).map((request) => <div key={request.id} className="flex items-center gap-2 rounded-md bg-secondary/70 p-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{request.title}</p><p className="truncate text-xs text-muted-foreground">{request.artist}</p></div><Button variant="ghost" size="icon" onClick={() => void update(request.id, 'played')} aria-label={`Mark ${request.title} as played`}><Check className="size-4 text-emerald-400" /></Button><Button variant="ghost" size="icon" onClick={() => void update(request.id, 'skipped')} aria-label={`Skip ${request.title}`}><X className="size-4 text-muted-foreground" /></Button></div>)}</div>}
  </div>
}
