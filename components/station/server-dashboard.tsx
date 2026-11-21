'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Activity, AlertTriangle, CheckCircle2, Database, HardDrive, MemoryStick, RefreshCw, Server, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { STATIONS, STATION_ORDER } from '@/lib/stations'
import { PROGRAMS } from '@/lib/schedule'

type ServerStatus = {
  error?: string
  server?: { status: string; uptimeSeconds: number; checkedAt: number }
  database?: { ok: boolean; error?: string }
  storage?: { configured: boolean; provider: string; usage?: { available: boolean; usedBytes: number; objectCount: number; provider: string; error?: string } }
  memory?: { heapUsedMb: number; heapTotalMb: number; rssMb: number }
}
const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json() as ServerStatus
  if (!response.ok) throw new Error(data.error || 'Could not load server status.')
  return data
}
const mb = (bytes: number) => (bytes / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 2 })
const percent = (used: number, total: number) => total > 0 ? Math.min(100, Math.round(used / total * 100)) : 0
const formatHour = (hour: number) => `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`
const artistCount = new Set(Object.values(PROGRAMS).flatMap((program) => [...program.pools.english, ...program.pools.tagalog].map((artist) => artist.name))).size

function MetricCard({ icon: Icon, label, value, detail, tone = 'gold' }: {
  icon: typeof Server; label: string; value: string; detail: string; tone?: 'gold' | 'green' | 'blue'
}) {
  const tones = {
    gold: 'border-amber-400/20 from-amber-400/15 to-amber-400/[0.03] text-amber-300',
    green: 'border-emerald-400/20 from-emerald-400/15 to-emerald-400/[0.03] text-emerald-300',
    blue: 'border-sky-400/20 from-sky-400/15 to-sky-400/[0.03] text-sky-300',
  }
  return <div className={`rounded-2xl border bg-gradient-to-br p-4 ${tones[tone]}`}>
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted-foreground">{label}</span><Icon className="size-4" /></div>
    <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">{value}</p>
    <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
  </div>
}
function UsageBar({ label, used, total }: { label: string; used: number; total: number }) {
  const value = percent(used, total)
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-3 text-xs"><span className="font-medium">{label}</span><span className="tabular-nums text-muted-foreground">{used} / {total} MB · {value}%</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${value}%` }} /></div>
  </div>
}
function HealthRow({ icon: Icon, label, ok, detail }: { icon: typeof Server; label: string; ok: boolean; detail: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3">
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300'}`}><Icon className="size-4" /></span>
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
    {ok ? <CheckCircle2 className="size-5 shrink-0 text-emerald-400" /> : <AlertTriangle className="size-5 shrink-0 text-amber-300" />}
  </div>
}

export function ServerDashboard() {
  const [open, setOpen] = useState(false)
  const { data, error, isLoading, mutate } = useSWR(open ? '/api/admin/server' : null, fetcher, { refreshInterval: 15000, revalidateOnFocus: true })
  const storage = data?.storage?.usage
  const storageMb = storage?.available ? Number(mb(storage.usedBytes)) : null
  return <>
    <Button type="button" variant="ghost" className="h-14 w-full flex-col gap-1 rounded-xl text-xs focus-visible:border-transparent focus-visible:ring-0" onClick={() => setOpen(true)}><Server className="size-5" />Server</Button>
    {open && <div className="fixed inset-0 z-[70] overflow-y-auto bg-background/95 p-3 backdrop-blur-md sm:p-6" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="server-dashboard-title" className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 pb-6 pt-3 text-left">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Server className="size-6" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Control center</p><h2 id="server-dashboard-title" className="text-xl font-bold sm:text-2xl">RJ FM Server Dashboard</h2><p className="text-xs text-muted-foreground">Live system health and resource usage</p></div></div>
          <Button type="button" variant="outline" size="icon" aria-label="Close server dashboard" onClick={() => setOpen(false)}><X /></Button>
        </header>
        {isLoading && <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Loading live server metrics…</div>}
        {error && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">{error.message} Sign in through Admin to view diagnostics.</div>}
        {data && <>
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3"><div className="flex items-center gap-2"><span className="size-2 animate-pulse rounded-full bg-emerald-400" /><span className="text-sm font-semibold">System {data.server?.status === 'online' ? 'Operational' : 'Status unknown'}</span></div><span className="text-xs tabular-nums text-muted-foreground">Uptime {Math.floor((data.server?.uptimeSeconds ?? 0) / 3600)}h {Math.floor(((data.server?.uptimeSeconds ?? 0) % 3600) / 60)}m</span></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard icon={Server} label="Application" value="ONLINE" detail="App process running" tone="green" />
            <MetricCard icon={Database} label="PostgreSQL" value={data.database?.ok ? 'CONNECTED' : 'OFFLINE'} detail={data.database?.ok ? 'Database reachable' : 'Connection needs attention'} tone={data.database?.ok ? 'green' : 'gold'} />
            <MetricCard icon={HardDrive} label="Storage used" value={storageMb === null ? '—' : `${storageMb} MB`} detail={storage?.available ? `${storage.objectCount.toLocaleString()} stored files` : 'Exact usage unavailable'} tone="blue" />
            <MetricCard icon={MemoryStick} label="RAM (RSS)" value={data.memory ? `${data.memory.rssMb} MB` : '—'} detail="Total process memory" tone="gold" />
          </div>
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2"><Activity className="size-5 text-primary" /><h3 className="font-bold">Resource usage</h3></div>
            <div className="space-y-5">
              {data.memory && <UsageBar label="JavaScript heap" used={data.memory.heapUsedMb} total={data.memory.heapTotalMb} />}
              {data.memory && <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-secondary/50 p-3"><p className="text-[11px] text-muted-foreground">Heap used</p><p className="mt-1 text-lg font-bold tabular-nums">{data.memory.heapUsedMb} MB</p></div><div className="rounded-xl bg-secondary/50 p-3"><p className="text-[11px] text-muted-foreground">Heap allocated</p><p className="mt-1 text-lg font-bold tabular-nums">{data.memory.heapTotalMb} MB</p></div></div>}
              <div className="rounded-xl border border-border/70 bg-secondary/30 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">Station storage</p><span className="text-xs text-muted-foreground">{storage?.provider ?? data.storage?.provider ?? 'Unknown provider'}</span></div>
                {storage?.available ? <><p className="mt-2 text-2xl font-bold tabular-nums">{storageMb} MB</p><p className="text-xs text-muted-foreground">Actual total size of files in the storage bucket · {storage.objectCount.toLocaleString()} objects</p></> : <p className="mt-2 text-xs text-amber-200">{storage?.error ?? 'Storage usage could not be measured. Check storage connection and permissions.'}</p>}
                <p className="mt-2 text-[10px] text-muted-foreground">Capacity limit is not reported because the provider does not expose a verified quota here.</p>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5"><h3 className="mb-3 font-bold">Service health</h3><div className="space-y-2">
            <HealthRow icon={Server} label="Application server" ok={data.server?.status === 'online'} detail={`Uptime ${Math.floor((data.server?.uptimeSeconds ?? 0) / 60)} minutes`} />
            <HealthRow icon={Database} label="PostgreSQL database" ok={Boolean(data.database?.ok)} detail={data.database?.ok ? 'Connection successful' : data.database?.error ?? 'Database unavailable'} />
            <HealthRow icon={HardDrive} label="Station storage" ok={Boolean(data.storage?.configured && storage?.available)} detail={storage?.available ? 'Bucket readable and usage measured' : 'Storage connection or usage check needs attention'} />
          </div></section>
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h3 className="font-bold">RJ FM station network</h3><p className="text-xs text-muted-foreground">Station sign-off and sign-on schedule · Philippine time</p></div>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">{STATION_ORDER.length} stations</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STATION_ORDER.map((id) => {
                const station = STATIONS[id]
                return <div key={id} className="rounded-xl border border-border/70 bg-secondary/25 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="text-sm font-semibold">{station.name} <span className="font-mono text-primary">{station.frequency}</span></p><p className="text-[11px] text-muted-foreground">{station.city} · {station.modeLabel}</p></div>
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-300">AutoDJ</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-background/60 p-2"><p className="text-[10px] text-muted-foreground">Sign off</p><p className="mt-0.5 font-semibold tabular-nums">{formatHour(station.signOffHour)}</p></div>
                    <div className="rounded-lg bg-background/60 p-2"><p className="text-[10px] text-muted-foreground">Sign on</p><p className="mt-0.5 font-semibold tabular-nums">{formatHour(station.signOnHour)}</p></div>
                  </div>
                </div>
              })}
            </div>
          </section>
          <section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4 sm:p-5">
            <div className="flex items-center gap-2"><Activity className="size-5 text-amber-300" /><h3 className="font-bold">DZMM blocktime schedule</h3></div>
            <p className="mt-1 text-xs text-muted-foreground">Main RJ FM Manila · Philippine time · Monday to Saturday</p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/70 p-3"><div><p className="text-sm font-semibold">Morning blocktime</p><p className="text-[11px] text-muted-foreground">DZMM live stream</p></div><p className="font-mono text-sm font-bold text-primary">7:00–8:00 AM</p></div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/70 p-3"><div><p className="text-sm font-semibold">Evening blocktime</p><p className="text-[11px] text-muted-foreground">DZMM live stream</p></div><p className="font-mono text-sm font-bold text-primary">6:30–8:00 PM</p></div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/70 p-3"><div><p className="text-sm font-semibold">Night blocktime</p><p className="text-[11px] text-muted-foreground">Love Connect ident then DZMM</p></div><p className="font-mono text-sm font-bold text-primary">10:00 PM–3:00 AM</p></div>
            </div>
            <div className="mt-3 rounded-xl border border-border/70 bg-card/60 p-3">
              <p className="text-sm font-semibold">RJ FM Iloilo special blocktime</p>
              <p className="mt-1 text-xs text-muted-foreground">6:30–8:00 PM, Monday to Saturday. Other hours use its own AutoDJ music schedule.</p>
            </div>
          </section>
          <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">AutoDJ artist library</h3><p className="text-xs text-muted-foreground">Artist pools configured in the broadcast schedule</p></div><span className="font-mono text-2xl font-bold text-primary">{artistCount}</span></div>
            <p className="mt-2 text-xs text-muted-foreground">AutoDJ chooses tracks from the active program’s English and Tagalog artist pools, applies the station schedule, and manages rotation automatically.</p>
          </section>
          <p className="text-center text-[10px] text-muted-foreground">Auto-refresh every 15 seconds · Last checked {data.server?.checkedAt ? new Date(data.server.checkedAt).toLocaleTimeString() : '—'}</p>
        </>}
        <div className="mt-auto flex gap-2"><Button type="button" className="flex-1" onClick={() => void mutate()} disabled={isLoading}><RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh dashboard</Button><Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button></div>
      </section>
    </div>}
  </>
}
