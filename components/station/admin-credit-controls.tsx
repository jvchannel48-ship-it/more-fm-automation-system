'use client'

import { useEffect, useState } from 'react'
import { Gift, RefreshCw, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AdminCredits = { dailyAllowance: number; profiles: Array<{ user_id: string; email: string; display_name: string; daily_credits: number; bonus_credits: number; credit_date: string }> }

export function AdminCreditControls() {
  const [data, setData] = useState<AdminCredits | null>(null)
  const [dailyInput, setDailyInput] = useState('0')
  const [grantInput, setGrantInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    try {
      const response = await fetch('/api/admin/credits', { cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'Hindi ma-load ang credit accounts.')
      setData(result as AdminCredits); setDailyInput(String((result as AdminCredits).dailyAllowance))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi ma-load ang credit accounts.') }
  }
  useEffect(() => { void load() }, [])

  const update = async (method: 'PUT' | 'POST', body: object) => {
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/admin/credits', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'Hindi na-update ang credits.')
      if (method === 'PUT') setMessage(`Daily allowance set to ${result.dailyAllowance}. Mag-aapply ito sa susunod na daily reset.`)
      else setMessage(`Naidagdag ang ${result.addedCredits} bonus credits sa ${result.accountsUpdated} accounts.`)
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi na-update ang credits.') }
    finally { setBusy(false) }
  }

  const setDaily = () => {
    const amount = Number(dailyInput)
    if (!Number.isInteger(amount) || amount < 0) { setError('Whole number na 0 o higit pa ang ilagay.'); return }
    void update('PUT', { dailyAllowance: amount })
  }
  const grantAll = () => {
    const amount = Number(grantInput)
    if (!Number.isInteger(amount) || amount < 1) { setError('Whole number na 1 o higit pa ang ilagay.'); return }
    if (!window.confirm(`Magdagdag ng ${amount} bonus credits sa bawat ${data?.profiles.length ?? 0} registered accounts?`)) return
    setGrantInput(''); void update('POST', { addCredits: amount })
  }

  return <section className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
    <div><h3 className="flex items-center gap-2 font-semibold"><Users className="size-4" /> Listener accounts & credits</h3><p className="mt-1 text-xs text-muted-foreground">20 credits bawat matagumpay na song request. Manila time ang daily reset.</p></div>
    <div className="flex flex-col gap-2"><Label htmlFor="daily-credit-allowance">Daily credits per user</Label><div className="flex gap-2"><Input id="daily-credit-allowance" type="number" min="0" max="1000000" step="1" value={dailyInput} onChange={(event) => setDailyInput(event.target.value)} disabled={busy} /><Button type="button" variant="secondary" onClick={setDaily} disabled={busy}>Set daily</Button></div><p className="text-xs text-muted-foreground">Nag-aapply sa susunod na daily reset; ang kasalukuyang araw ay hindi nire-reset.</p></div>
    <div className="flex flex-col gap-2"><Label htmlFor="add-credit-all">Add bonus credits to all accounts</Label><div className="flex gap-2"><Input id="add-credit-all" type="number" min="1" max="1000000" step="1" value={grantInput} onChange={(event) => setGrantInput(event.target.value)} placeholder="Amount" disabled={busy} /><Button type="button" onClick={grantAll} disabled={busy || !grantInput}><Gift />Add to all</Button></div></div>
    <div className="flex items-center justify-between"><h4 className="text-sm font-medium">Users ({data?.profiles.length ?? 0})</h4><Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={busy}><RefreshCw className="size-3.5" />Refresh</Button></div>
    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-background/50 p-2">
      {data?.profiles.map((profile) => <div key={profile.user_id} className="flex items-center justify-between gap-3 border-b border-border/60 px-2 py-2 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{profile.display_name || profile.email || 'Listener'}</p><p className="truncate text-[11px] text-muted-foreground">{profile.email}</p></div><p className="shrink-0 text-right text-xs tabular-nums">{profile.daily_credits + profile.bonus_credits}<span className="block text-[10px] text-muted-foreground">daily {profile.daily_credits} · bonus {profile.bonus_credits}</span></p></div>)}
      {data && data.profiles.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">Wala pang registered accounts.</p>}
      {!data && !error && <p className="p-3 text-center text-xs text-muted-foreground">Loading account list…</p>}
    </div>
    {message && <p className="rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-200" role="status">{message}</p>}
    {error && <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive" role="alert">{error}</p>}
  </section>
}
