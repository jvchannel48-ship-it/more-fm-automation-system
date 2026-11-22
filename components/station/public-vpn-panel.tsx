'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Globe2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PublicServer = {
  ip: string
  country: string
  countryCode: string
  ping: number | null
  speed: number
  sessions: number
  score: number
  host: string
}

type DirectoryResponse = {
  servers?: PublicServer[]
  updatedAt?: string
  error?: string
}

function formatSpeed(value: number) {
  if (!value) return '—'
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)} Mbps` : `${Math.round(value / 1000)} Kbps`
}

export function PublicVpnPanel() {
  const [servers, setServers] = useState<PublicServer[]>([])
  const [selectedIp, setSelectedIp] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')

  const loadServers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/public-vpn', { cache: 'no-store' })
      const result = await response.json() as DirectoryResponse
      if (!response.ok || !result.servers?.length) throw new Error(result.error || 'No public servers are available.')
      setServers(result.servers)
      setSelectedIp((current) => result.servers?.some((server) => server.ip === current) ? current : result.servers?.[0]?.ip || '')
      setUpdatedAt(result.updatedAt || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load public servers.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadServers() }, [loadServers])

  const selected = useMemo(() => servers.find((server) => server.ip === selectedIp), [servers, selectedIp])

  const downloadProfile = async () => {
    if (!selected) return
    setDownloading(true)
    setError('')
    try {
      const response = await fetch(`/api/public-vpn?ip=${encodeURIComponent(selected.ip)}`, { cache: 'no-store' })
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(result.error || 'Could not download the VPN profile.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `rjfm-${selected.ip.replace(/[^0-9.]/g, '-')}.ovpn`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Profile download failed.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="w-full rounded-2xl border border-primary/25 bg-card/70 p-4 text-left shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><ShieldCheck className="size-5" /></span>
          <div>
            <h2 className="text-sm font-bold tracking-wide">PUBLIC VPN SERVERS</h2>
            <p className="text-[11px] text-muted-foreground">VPN Gate · OpenVPN profiles</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => void loadServers()} disabled={loading} aria-label="Refresh public VPN servers">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>
      </div>

      <label htmlFor="rjfm-public-vpn-server" className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Select public server</label>
      <select
        id="rjfm-public-vpn-server"
        value={selectedIp}
        onChange={(event) => setSelectedIp(event.target.value)}
        disabled={loading || !servers.length}
        className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
      >
        {servers.map((server) => (
          <option key={server.ip} value={server.ip}>{server.country} · {server.ip} · {formatSpeed(server.speed)}</option>
        ))}
      </select>

      {selected && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-background/70 p-2"><p className="text-[9px] uppercase text-muted-foreground">Ping</p><p className="mt-1 font-mono text-sm font-semibold">{selected.ping ? `${selected.ping} ms` : '—'}</p></div>
          <div className="rounded-xl bg-background/70 p-2"><p className="text-[9px] uppercase text-muted-foreground">Reported speed</p><p className="mt-1 font-mono text-sm font-semibold">{formatSpeed(selected.speed)}</p></div>
          <div className="rounded-xl bg-background/70 p-2"><p className="text-[9px] uppercase text-muted-foreground">Sessions</p><p className="mt-1 font-mono text-sm font-semibold">{selected.sessions.toLocaleString()}</p></div>
        </div>
      )}

      <a
        href="https://play.google.com/store/apps/details?id=net.openvpn.openvpn"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 text-sm font-semibold text-primary transition hover:bg-primary/15"
      >
        <ShieldCheck className="size-4" /> INSTALL OPENVPN CONNECT (ANDROID)
      </a>

      <Button type="button" className="mt-4 w-full gap-2" onClick={() => void downloadProfile()} disabled={!selected || loading || downloading}>
        {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        DOWNLOAD OPENVPN PROFILE
      </Button>

      {loading && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Loading live server directory…</p>}
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
      {updatedAt && <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><Globe2 className="size-3" /> Directory checked {new Date(updatedAt).toLocaleTimeString()}</p>}

      <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
        Public volunteer servers can be unstable and may log activity. Their operators control the bandwidth, so MSIC cannot enforce the 900 Kbps per-user limit on these profiles. The 900 Kbps cap applies only after an MSIC-managed OpenVPN server has been configured with the GCP traffic-shaping hook. Downloading a profile does not connect the VPN automatically; import the .ovpn file into OpenVPN Connect. This uses regular mobile data and is not a carrier no-load service. Avoid public relays for banking or sensitive accounts.
      </p>
    </section>
  )
}
