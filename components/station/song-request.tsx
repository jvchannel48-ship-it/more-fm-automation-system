'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, MessageCircle, Radio, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ensureDeviceSession } from '@/lib/device-id'
import type { StationId } from '@/lib/stations'

type RequestStatus = 'idle' | 'submitting' | 'success' | 'error'
type CreditInfo = { creditsRemaining: number; dailyCredits: number; bonusCredits: number }
type RequestResult = { error?: string; position?: number; creditsRemaining?: number; creditEmpty?: boolean; autoDjQueued?: boolean; resolved?: boolean; duplicate?: boolean }

export function SongRequest({ station }: { station: StationId }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [message, setMessage] = useState('')
  const [credits, setCredits] = useState<CreditInfo | null>(null)

  useEffect(() => {
    let active = true
    const loadCredits = async () => {
      if (document.visibilityState !== 'visible') return
      const response = await fetch('/api/account/profile', { cache: 'no-store' })
      const data = await response.json().catch(() => ({})) as CreditInfo & { error?: string }
      if (active) setCredits(response.ok ? data : null)
    }
    void loadCredits()
    const timer = window.setInterval(() => { void loadCredits() }, 3000)
    return () => { active = false; window.clearInterval(timer) }
  }, [status])

  const close = () => {
    if (status === 'submitting') return
    setOpen(false)
    setStatus('idle')
    setMessage('')
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('submitting'); setMessage('')
    try {
      if (!credits) {
        const linked = await ensureDeviceSession()
        if (!linked) {
          setStatus('error'); setMessage('Could not link this device. Refresh the station and try again.'); return
        }
        const profileResponse = await fetch('/api/account/profile', { cache: 'no-store' })
        const profileData = await profileResponse.json().catch(() => ({})) as CreditInfo
        if (profileResponse.ok) setCredits(profileData)
      }
      const response = await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist, station }), cache: 'no-store',
      })
      const data = await response.json().catch(() => ({})) as RequestResult
      if (!response.ok) {
        if (typeof data.creditsRemaining === 'number') setCredits((current) => current ? { ...current, creditsRemaining: data.creditsRemaining! } : { creditsRemaining: data.creditsRemaining!, dailyCredits: 0, bonusCredits: 0 })
        if (data.creditEmpty) { setStatus('error'); setMessage(data.error ?? "YOUR CREDIT IT'S 0 TRY AGAIN TOMORROW FREE DAILY"); return }
        throw new Error(data.error || 'Could not submit the song request.')
      }
      if (typeof data.creditsRemaining === 'number') setCredits((current) => current ? { ...current, creditsRemaining: data.creditsRemaining! } : current)
      setStatus('success')
      setMessage(data.duplicate
        ? `This song is already in the ${station.toUpperCase()} Auto DJ queue at position #${data.position ?? 1}. No extra credits were charged.`
        : `Accepted by ${station.toUpperCase()} Auto DJ at queue position #${data.position ?? 1}. Auto DJ will keep searching for a playable version and schedule it when available. 15 credits were used.`)
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Could not submit the song request.') }
  }

  return <>
    <div className="flex w-full max-w-xs flex-col items-center gap-2">
      <Button type="button" className="h-11 w-full bg-primary/15 text-primary ring-1 ring-primary/30 hover:bg-primary/25" onClick={() => setOpen(true)}>
        <MessageCircle aria-hidden="true" /> Make a song request
      </Button>
    </div>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section role="dialog" aria-modal="true" aria-labelledby="song-request-title" className="relative w-full max-w-md overflow-hidden rounded-3xl border border-primary/25 bg-card/95 text-left shadow-2xl shadow-black/50">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20" aria-hidden="true" />
        <div className="p-6 sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25"><Radio className="size-5" aria-hidden="true" /></div>
              <div><p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">On-air request line</p><h2 id="song-request-title" className="text-xl font-semibold tracking-tight">Choose your next song</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">A valid request uses 15 credits (30 for 2 songs). Credits are not charged if the song is not found or the queue is full.</p></div>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Close song request" onClick={close}><X aria-hidden="true" /></Button>
          </div>
          {status === 'success' ? <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="size-10 text-emerald-400" aria-hidden="true" />
            <div><p className="text-base font-semibold">Song request successful</p><p className="mt-1 text-sm text-muted-foreground">{message}</p></div>
            <Button type="button" className="w-full" onClick={close}>Done</Button>
          </div> : (status === 'error' && (message.toLowerCase().includes("credit it's 0") || message.toLowerCase().includes('credit is 0') || (credits?.creditsRemaining ?? 1) === 0)) ? <div className="flex flex-col items-center gap-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-6 text-center">
            <p className="text-lg font-semibold uppercase tracking-wide">{(credits?.creditsRemaining ?? 0) <= 0 ? "YOUR CREDIT IT'S 0" : 'Not enough credits'}</p>
            <p className="text-sm text-muted-foreground">{(credits?.creditsRemaining ?? 0) <= 0 ? 'TRY AGAIN TOMORROW FREE DAILY' : message}</p>
            <Button type="button" variant="outline" className="w-full" onClick={close}>Exit</Button>
          </div> : <form onSubmit={submit} className="flex flex-col gap-4">
            {credits && <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm">Credits available: <strong>{credits.creditsRemaining}</strong> (15 per song · 30 for 2)</p>}
            <div className="rounded-2xl border border-border/80 bg-background/40 p-4"><div className="flex flex-col gap-2"><Label htmlFor="request-title">Song title</Label><Input id="request-title" className="h-10 bg-background/60" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Ikaw" maxLength={120} required disabled={status === 'submitting'} autoFocus /></div>
              <div className="mt-4 flex flex-col gap-2"><Label htmlFor="request-artist">Artist</Label><Input id="request-artist" className="h-10 bg-background/60" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="e.g. Yeng Constantino" maxLength={120} required disabled={status === 'submitting'} /></div></div>
            {status === 'submitting' && <div className="space-y-2" role="status" aria-live="polite"><div className="h-2 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label="Submitting song request" aria-busy="true"><div className="h-full w-1/3 rounded-full bg-primary" style={{ animation: 'request-progress 1.2s ease-in-out infinite' }} /></div></div>}
            {status === 'error' && message && <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert"><p>{message}</p></div>}
            <Button type="submit" className="h-11 w-full" disabled={status === 'submitting' || !title.trim() || !artist.trim()}><MessageCircle aria-hidden="true" />{status === 'submitting' ? 'Checking song…' : 'Submit request'}</Button>
          </form>}
        </div>
      </section>
    </div>}
  </>
}
