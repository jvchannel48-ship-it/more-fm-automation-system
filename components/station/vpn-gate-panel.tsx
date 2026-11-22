'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownToLine, ExternalLink, Globe2, LoaderCircle, RefreshCw, Search, ShieldCheck, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Server = { ip: string; country: string; countryCode: string; score: number; ping: number; speed: number; sessions: number }

const flag = (code: string) => code?.length === 2 ? String.fromCodePoint(...[...code.toUpperCase()].map((char) => 127397 + char.charCodeAt(0))) : '🌐'
const speedLabel = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)} Mbps` : value > 0 ? `${Math.round(value / 1000)} Kbps` : '—'

export function VpnGatePanel() {
  const [servers, setServers] = useState<Server[]>([])
  const [country, setCountry] = useState('ALL')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'fastest' | 'ping' | 'speed'>('fastest')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')

  const loadServers = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/vpn-gate', { cache: 'no-store' })
      const data = await response.json() as { servers?: Server[]; error?: string; updatedAt?: string }
      if (!response.ok) throw new Error(data.error || 'Hindi ma-load ang VPN servers.')
      setServers(data.servers ?? []); setUpdatedAt(data.updatedAt ?? '')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Hindi ma-load ang VPN servers.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadServers() }, [loadServers])

  const countries = useMemo(() => [...new Map(servers.map((server) => [server.countryCode, { code: server.countryCode, name: server.country }])).values()].sort((a, b) => a.name.localeCompare(b.name)), [servers])
  const visible = useMemo(() => servers.filter((server) => (country === 'ALL' || server.countryCode === country) && `${server.country} ${server.ip}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'ping' ? a.ping - b.ping : sort === 'speed' ? b.speed - a.speed : (b.score - a.score) || (a.ping - b.ping)).slice(0, 60), [servers, country, query, sort])

  const downloadProfile = async (server: Server) => {
    setDownloading(server.ip); setError('')
    try {
      const response = await fetch('/api/vpn-gate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip: server.ip }) })
      if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error || 'Hindi ma-download ang profile.') }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
      anchor.href = url; anchor.download = `rjfm-${server.ip.replaceAll('.', '-')}.ovpn`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Profile download failed.') }
    finally { setDownloading(null) }
  }

  return <section className="overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 shadow-xl shadow-sky-950/20">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex size-10 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300"><ShieldCheck className="size-5" /></span><div><h3 className="font-bold tracking-wide">RJ FM VPN GATE</h3><p className="text-[11px] text-slate-400">Free public volunteer servers</p></div></div><Button type="button" size="icon" variant="ghost" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => void loadServers()} disabled={loading} aria-label="Refresh VPN servers">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}</Button></div>
    <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-white/5 p-3"><p className="text-xl font-bold tabular-nums">{servers.length}</p><p className="text-[10px] text-slate-400">Servers</p></div><div className="rounded-xl bg-white/5 p-3"><p className="text-xl font-bold tabular-nums">{countries.length}</p><p className="text-[10px] text-slate-400">Countries</p></div><div className="rounded-xl bg-white/5 p-3"><p className="text-xl font-bold tabular-nums">{servers.filter((server) => server.ping > 0).length}</p><p className="text-[10px] text-slate-400">With ping data</p></div></div>
    <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3"><Search className="size-4 shrink-0 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search country or server IP" className="border-0 bg-transparent text-white placeholder:text-slate-500 focus-visible:ring-0" /></div>
    <div className="mt-3 grid grid-cols-2 gap-2"><select aria-label="Filter by country" value={country} onChange={(event) => setCountry(event.target.value)} className="h-10 min-w-0 rounded-lg border border-white/10 bg-slate-900 px-2 text-xs text-white"><option value="ALL">🌐 All countries</option>{countries.map((item) => <option key={item.code} value={item.code}>{flag(item.code)} {item.name}</option>)}</select><select aria-label="Sort servers" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="h-10 min-w-0 rounded-lg border border-white/10 bg-slate-900 px-2 text-xs text-white"><option value="fastest">⚡ Best score</option><option value="ping">Lowest ping</option><option value="speed">Highest speed</option></select></div>
    {error && <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-200" role="alert">{error}</p>}
    <div className="mt-3 flex max-h-[390px] flex-col gap-2 overflow-y-auto pr-1">{loading && servers.length === 0 ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><LoaderCircle className="size-4 animate-spin" />Loading live servers…</div> : visible.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No matching servers. Refresh and try again.</p> : visible.map((server) => <div key={server.ip} className="rounded-xl border border-white/10 bg-white/[0.045] p-3"><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="text-xl">{flag(server.countryCode)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{server.country}</p><p className="font-mono text-[10px] text-slate-400">{server.ip}</p></div></div><Button type="button" size="sm" className="shrink-0 bg-sky-500 text-white hover:bg-sky-400" onClick={() => void downloadProfile(server)} disabled={downloading !== null}>{downloading === server.ip ? <LoaderCircle className="size-3 animate-spin" /> : <ArrowDownToLine className="size-3" />}{downloading === server.ip ? 'Preparing' : 'Get .ovpn'}</Button></div><div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-slate-400"><span className="flex items-center gap-1"><Activity className="size-3" />{server.ping > 0 ? `${server.ping} ms` : 'Ping —'}</span><span className="flex items-center gap-1"><Zap className="size-3" />{speedLabel(server.speed)}</span><span className="flex items-center gap-1"><Globe2 className="size-3" />{server.sessions} users</span></div></div>)}</div>
    <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3"><p className="text-xs font-semibold text-amber-100">Connection uses OpenVPN Connect</p><p className="mt-1 text-[11px] leading-5 text-amber-100/70">Download a server profile, then import it into OpenVPN Connect and tap Connect there. RJ FM cannot start or verify a system VPN tunnel from this website.</p><a href="https://play.google.com/store/apps/details?id=net.openvpn.openvpn" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-300">Install OpenVPN Connect <ExternalLink className="size-3" /></a></div>
    {updatedAt && <p className="mt-3 text-center text-[10px] text-slate-500">Directory refreshed {new Date(updatedAt).toLocaleTimeString()}</p>}
    <p className="mt-2 text-[10px] leading-4 text-slate-500">Public volunteer relays may be slow, unstable, or operated by unknown parties. Do not use for banking or sensitive accounts. Ping and speed values are directory-reported, not measured from this phone.</p>
  </section>
}
