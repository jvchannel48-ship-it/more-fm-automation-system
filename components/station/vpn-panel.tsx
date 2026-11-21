'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, ShieldCheck, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function VpnPanel() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener('morefm:open-vpn', show)
    return () => window.removeEventListener('morefm:open-vpn', show)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="vpn-title" className="relative w-full max-w-md rounded-3xl border border-primary/25 bg-card p-6 shadow-2xl">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close VPN" onClick={() => setOpen(false)} className="absolute right-4 top-4"><X /></Button>
        <div className="flex items-center gap-3 pr-8">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary"><ShieldCheck /></span>
          <div>
            <h2 id="vpn-title" className="text-xl font-semibold">RJ FM VPN</h2>
            <p className="text-sm text-muted-foreground">Public VPN server configurations</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 text-amber-400" />Public volunteer servers</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">These servers are operated by independent volunteers, not RJ FM. Their speed, location and availability can change. Do not use them for banking or sensitive activity. This page does not claim that a VPN tunnel is connected.</p>
        </div>

        <div className="mt-4 space-y-3">
          <a href="https://www.vpngate.net/en/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-2xl border border-border/70 bg-secondary/50 p-4 hover:bg-secondary">
            <span><span className="block font-medium">Browse free VPN servers</span><span className="mt-1 block text-xs text-muted-foreground">Choose a public relay and download its OpenVPN (.ovpn) profile</span></span>
            <ExternalLink className="size-4 shrink-0 text-primary" />
          </a>
          <a href="https://www.vpngate.net/en/howto_openvpn.aspx" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-2xl border border-border/70 bg-secondary/50 p-4 hover:bg-secondary">
            <span><span className="block font-medium">How to connect on Android</span><span className="mt-1 block text-xs text-muted-foreground">Import the profile in OpenVPN Connect, then tap Connect</span></span>
            <ExternalLink className="size-4 shrink-0 text-primary" />
          </a>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">For now, connection is handled by the official OpenVPN app after you import a profile. Built-in RJ FM VPN connect/disconnect needs native Android VPN integration and a verified server tunnel; it is not active yet.</p>
      </section>
    </div>
  )
}
