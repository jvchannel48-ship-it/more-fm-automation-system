'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { RefreshCw,ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { AdminStatus } from '@/lib/types'
import { Textarea } from '@/components/ui/textarea'
import { DailyTriviaAdmin } from './daily-trivia-admin'
import { ScreenBannerAdmin } from './screen-banner-admin'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Unauthorized')
    return r.json() as Promise<AdminStatus>
  })

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-secondary px-3 py-2">
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

export function AdminPanel() {
  const { data, mutate } = useSWR('/api/admin/settings', fetcher, { refreshInterval: 15000 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [whatsNewDraft, setWhatsNewDraft] = useState<string | null>(null)\n  const [artistDraft,setArtistDraft]=useState<string|null>(null)\n  const [scanResult,setScanResult]=useState<string[]>([])

  const send = async (method: 'PUT' | 'POST', body?: object) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/settings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) throw new Error(res.status === 401 ? 'Nag-expire ang admin session. Mag-login ulit.' : 'Hindi na-save ang setting. Subukan ulit.')
      mutate((await res.json()) as AdminStatus, { revalidate: false })
      if (body && 'whatsNew' in body) setWhatsNewDraft(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'May error sa pag-save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="broadcast">Broadcast</Label>
          <span className="text-xs text-muted-foreground">
            {data?.broadcastEnabled === false ? 'Naka-off ang livestream' : 'Auto on 4:00 AM · auto off 1:00 AM'}
          </span>
        </div>
        <Switch
          id="broadcast"
          checked={data?.broadcastEnabled ?? true}
          disabled={!data || busy}
          onCheckedChange={(checked) => send('PUT', { broadcastEnabled: checked })}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="remix-mode">Remix ON / OFF</Label>
          <span className="text-xs text-muted-foreground">ON: techno / disco remix rotation only</span>
        </div>
        <button
          id="remix-mode"
          type="button"
          role="switch"
          aria-checked={data?.remixMode ?? false}
          disabled={busy}
          onClick={() => send('PUT', { remixMode: !(data?.remixMode ?? false) })}
          className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${data?.remixMode ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`pointer-events-none block size-6 rounded-full bg-background shadow transition-transform ${data?.remixMode ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="full-bass">Full Bass</Label>
          <span className="text-xs text-muted-foreground">Bass processing setting</span>
        </div>
        <button
          id="full-bass"
          type="button"
          role="switch"
          aria-checked={data?.fullBass ?? false}
          disabled={busy}
          onClick={() => send('PUT', { fullBass: !(data?.fullBass ?? false) })}
          className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${data?.fullBass ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`pointer-events-none block size-6 rounded-full bg-background shadow transition-transform ${data?.fullBass ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5"><Label htmlFor="auto-post">Auto Post Now Playing</Label><span className="text-xs text-muted-foreground">Automatically publish song title and artist to Media Feed while ON.</span></div>
        <button id="auto-post" type="button" role="switch" aria-checked={data?.autoPost??false} disabled={busy} onClick={() => send('PUT',{autoPost:!(data?.autoPost??false)})} className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-transparent transition-colors disabled:opacity-60 ${data?.autoPost?'bg-primary':'bg-muted'}`}><span className={`pointer-events-none block size-6 rounded-full bg-background shadow transition-transform ${data?.autoPost?'translate-x-6':'translate-x-0'}`} /></button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Songs / 7 days" value={data?.songsThisWeek ?? '–'} />
        <Stat label="Artists / hour" value={data?.artistsThisHour ?? '–'} />
        <Stat label="Queued" value={data?.queued ?? '–'} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4"><Label htmlFor="whats-new-editor">What's New (public announcement)</Label><Textarea id="whats-new-editor" rows={5} maxLength={5000} placeholder="Write an announcement here..." value={whatsNewDraft ?? data?.whatsNew ?? ''} disabled={!data || busy} onChange={(e) => setWhatsNewDraft(e.target.value)} /><Button disabled={busy || whatsNewDraft === null || whatsNewDraft === data?.whatsNew} onClick={() => send('PUT', { whatsNew: whatsNewDraft })}>Save What's New</Button><span className="text-xs text-muted-foreground">Saved announcements appear on the public homepage.</span></div>

      <section className="space-y-3 border-t pt-4"><h3 className="font-semibold flex items-center gap-2"><ShieldCheck/>Advanced Security</h3><div className="flex items-center justify-between gap-2"><div><Label>Cloudflare Verification toggle</Label><p className="text-xs text-muted-foreground">Requires Turnstile site and secret keys configured in Vercel environment.</p></div><Switch checked={data?.cloudflareVerification??false} disabled={!data||busy} onCheckedChange={(v)=>send('PUT',{cloudflareVerification:v})}/></div><Button variant="outline" onClick={()=>setScanResult(['Admin API checks: admin-session gate is present on settings endpoint (source-reviewed).','Image and JSON storage are hosted via Vercel Blob.','Cloudflare Turnstile is not verified until Turnstile keys and server validation are configured.','Security scan is a basic configuration review, not a penetration test.'])}>Run security scan</Button>{scanResult.map((x,i)=><p key={i} className="text-xs">{x}</p>)}</section>
      <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Add Artist / Genre to rotation</h3><p className="text-xs text-muted-foreground">Format one per line: Artist Name | Genre | english or tagalog. This saves a list for custom rotation integration.</p><Textarea rows={5} placeholder="Artist Name | Pop | english" value={artistDraft??(data?.customArtists??[]).map((a:any)=>a.name+' | '+a.genre+' | '+a.language).join('\n')} onChange={e=>setArtistDraft(e.target.value)} disabled={!data||busy}/><Button disabled={busy||artistDraft===null} onClick={()=>{const parsed=artistDraft.split('\n').map(line=>line.split('|').map(v=>v.trim())).filter(a=>a.length>=3&&a[0]&&a[1]&&(a[2]==='english'||a[2]==='tagalog')).map(a=>({name:a[0],genre:a[1],language:a[2] as 'english'|'tagalog'}));send('PUT',{customArtists:parsed});setArtistDraft(null)}}>Save Artist & Genre list</Button></section>
      <ScreenBannerAdmin />
      <DailyTriviaAdmin />

      <Button variant="secondary" disabled={busy} onClick={() => send('POST')}>
        <RefreshCw className={busy ? 'animate-spin' : undefined} aria-hidden="true" />
        Refresh rotation
      </Button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Automated songs only. Strict rules: no AI, no covers, no rock, English &amp; Tagalog only, no repeat song
        within 7 days, max 2 plays per artist per hour.
      </p>
    </div>
  )
}
