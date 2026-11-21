'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, ShieldCheck, X, AlertTriangle, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

const NETWORKS = [
  { id: 'DITO', name: 'DITO', url: 'https://dito.ph/promos', note: 'Level-Up, Data Maxx, Socials at UNLI 5G' },
  { id: 'TNT', name: 'TNT', url: 'https://tntph.com/Pages/sayaall', note: 'Saya All at TikTok Saya' },
  { id: 'SMART', name: 'SMART', url: 'https://store.smart.com.ph/promos-and-add-ons/smart-prepaid', note: 'Power All, Magic Data at daily data' },
  { id: 'GOMO', name: 'GOMO', url: 'https://www.gomo.ph/data-offers', note: 'No-expiry data at UNLI offers' },
] as const

export function VpnPanel() {
  const [open, setOpen] = useState(false)
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]['id']>('TNT')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const openFreeVpnSetup = () => {
    if (cooldown > 0) return
    setCooldown(40)
    window.open('https://one.one.one.one/', '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener('morefm:open-vpn', show)
    return () => window.removeEventListener('morefm:open-vpn', show)
  }, [])

  if (!open) return null
  const selected = NETWORKS.find((item) => item.id === network) ?? NETWORKS[0]

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="vpn-title" className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-primary/25 bg-card p-6 shadow-2xl">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close VPN" onClick={() => setOpen(false)} className="absolute right-4 top-4"><X /></Button>
        <div className="flex items-center gap-3 pr-8">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary"><ShieldCheck /></span>
          <div>
            <h2 id="vpn-title" className="text-xl font-semibold">RJ FM VPN & Network</h2>
            <p className="text-sm text-muted-foreground">Choose your SIM network and check its official promos</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {NETWORKS.map((item) => (
            <button key={item.id} type="button" onClick={() => setNetwork(item.id)} aria-pressed={network === item.id} className={`rounded-xl border p-3 text-left transition ${network === item.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-secondary/40 text-muted-foreground'}`}>
              <span className="block font-semibold">{item.name}</span>
              <span className="mt-1 block text-[11px] leading-snug">{item.note}</span>
            </button>
          ))}
        </div>

        <a href={selected.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 p-4">
          <span><span className="block font-medium">View {selected.name} official promos</span><span className="mt-1 block text-xs text-muted-foreground">Check current eligibility, price, data and validity</span></span>
          <ExternalLink className="size-4 shrink-0 text-primary" />
        </a>

        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 text-amber-400" />Important about VPN and promos</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">A VPN does not create free data or turn app-only/social data into all-access data. It may also stop a carrier from recognizing traffic for a promo. Use the data allowance and terms included in your active subscription.</p>
        </div>

        <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/50 p-4">
          <div className="flex items-center gap-2"><Smartphone className="size-4 text-primary" /><p className="font-medium">Real VPN connection</p></div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Built-in Connect/Disconnect is not active yet. It needs a verified VPN server that we control or are authorized to use, plus native Android VpnService integration and a real tunnel test. Public VPN configs from strangers are not a safe substitute, and this panel does not claim to be connected.</p>
        </div>
      </section>
    </div>
  )
}
