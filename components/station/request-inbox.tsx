'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Check, Clock3, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SongRequest } from '@/lib/types'

type RequestsPayload = { requests: SongRequest[] }

async function fetcher(url: string): Promise<RequestsPayload> {
  const response = await fetch(url, { cache: 'no-store' })
  const result = await response.json().catch(() => null) as (RequestsPayload & { error?: unknown }) | null
  if (!response.ok) {
    throw new Error(result && typeof result.error === 'string' ? result.error : `Could not load requests (${response.status}).`)
  }
  if (!result || !Array.isArray(result.requests)) throw new Error('The server returned an invalid request list.')
  return result
}

export function RequestInbox() {
  const { data, error, mutate } = useSWR('/api/admin/requests', fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  })
  const [actionError, setActionError] = useState('')
  const [updatingId, setUpdatingId] = useState('')

  const update = async (id: string, status: 'played' | 'skipped') => {
    if (updatingId) return
    setUpdatingId(id)
    setActionError('')
    try {
      const response = await fetch('/api/admin/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const result = await response.json().catch(() => null) as { error?: unknown } | null
      if (!response.ok) throw new Error(result && typeof result.error === 'string' ? result.error : `Could not update request (${response.status}).`)
      await mutate()
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Could not update song request.')
    } finally {
      setUpdatingId('')
    }
  }

  const pending = data?.requests?.filter((request) => request.status === 'pending') ?? []
  return <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
    <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Song requests</h3><p className="text-xs text-muted-foreground">All pending requests · auto-refresh every 5 seconds.</p></div><Clock3 className="size-4 text-primary" aria-hidden="true" /></div>
    {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{error.message || 'Could not load song requests.'}</p>}
    {actionError && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{actionError}</p>}
    {!data && !error ? <p className="text-xs text-muted-foreground">Loading requests…</p> : pending.length === 0 ? <p className="text-xs text-muted-foreground">No pending requests.</p> : <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">{pending.map((request) => <div key={request.id} className="flex items-center gap-2 rounded-md bg-secondary/70 p-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{request.title}</p><p className="truncate text-xs text-muted-foreground">{request.artist}</p></div><Button variant="ghost" size="icon" disabled={Boolean(updatingId)} onClick={() => void update(request.id, 'played')} aria-label={`Mark ${request.title} as played`}><Check className="size-4 text-emerald-400" /></Button><Button variant="ghost" size="icon" disabled={Boolean(updatingId)} onClick={() => void update(request.id, 'skipped')} aria-label={`Skip ${request.title}`}><X className="size-4 text-muted-foreground" /></Button></div>)}</div>}
  </div>
}
