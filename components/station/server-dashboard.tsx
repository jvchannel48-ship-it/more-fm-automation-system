'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Database, HardDrive, RefreshCw, Server, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ServerStatus = {
  error?: string
  server?: { status: string; uptimeSeconds: number; checkedAt: number }
  database?: { ok: boolean; error?: string }
  storage?: { configured: boolean; provider: string }
  memory?: { heapUsedMb: number; heapTotalMb: number; rssMb: number }
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json() as ServerStatus
  if (!response.ok) throw new Error(data.error || 'Could not load server status.')
  return data
}

function StatusLine({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/40 p-3">
    <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-300'}`}>{ok ? 'OK' : 'Check'}</span>
  </div>
}

export function ServerDashboard() {
  const [open, setOpen] = useState(false)
  const { data, error, isLoading, mutate } = useSWR(open ? '/api/admin/server' : null, fetcher, { refreshInterval: 15000, revalidateOnFocus: true })

  return <>
    <Button type="button" variant="ghost" className="h-14 w-full flex-col gap-1 rounded-xl text-xs focus-visible:border-transparent focus-visible:ring-0" onClick={() => setOpen(true)}>
      <Server className="size-5" />Server
    </Button>
    {open && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="server-dashboard-title" className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-primary/25 bg-card p-5 text-left shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Server className="size-5" /></span><div><h2 id="server-dashboard-title" className="text-lg font-semibold">RJ FM Server</h2><p className="text-xs text-muted-foreground">Live infrastructure diagnostics</p></div></div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close server dashboard" onClick={() => setOpen(false)}><X /></Button>
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {isLoading && <p className="text-sm text-muted-foreground">Checking server, database and storage…</p>}
          {error && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">{error.message} Sign in through Admin to view diagnostics.</div>}
          {data && <>
            <StatusLine label="Application server" ok={data.server?.status === 'online'} detail={data.server ? `Online · uptime ${Math.floor(data.server.uptimeSeconds / 3600)}h ${Math.floor((data.server.uptimeSeconds % 3600) / 60)}m` : 'Status unavailable'} />
            <StatusLine label="PostgreSQL" ok={Boolean(data.database?.ok)} detail={data.database?.ok ? 'Database connection successful' : data.database?.error || 'Not connected'} />
            <StatusLine label="Station storage" ok={Boolean(data.storage?.configured)} detail={data.storage?.configured ? `${data.storage.provider} configured` : 'Storage unavailable; server may use temporary memory'} />
            <div className="rounded-xl border border-border/70 bg-secondary/40 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><HardDrive className="size-4" />Server memory</div>
              <div className="grid grid-cols-3 gap-2 text-center">{[['Heap used', data.memory?.heapUsedMb], ['Heap total', data.memory?.heapTotalMb], ['RAM (RSS)', data.memory?.rssMb]].map(([label, value]) => <div key={String(label)}><p className="text-base font-semibold tabular-nums">{value ?? '—'}<span className="ml-0.5 text-[10px] font-normal text-muted-foreground">MB</span></p><p className="text-[10px] text-muted-foreground">{label}</p></div>)}</div>
            </div>
            <p className="text-[10px] text-muted-foreground">Checked {data.server?.checkedAt ? new Date(data.server.checkedAt).toLocaleTimeString() : '—'} · Storage status shows configuration/last read health, not total bucket capacity.</p>
          </>}
          <Button type="button" variant="outline" className="w-full" onClick={() => void mutate()} disabled={isLoading}><RefreshCw className="size-4" />Refresh status</Button>
        </div>
      </section>
    </div>}
  </>
}
