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
  const [confirmGrant, setConfirmGrant] = useState<number | null>(null)

  const load = async (syncAllowanceInput = false) => {
    try {
      const response = await fetch('/api/admin/credits', { cache: 'no-store' })
      const result = await response.json().catch(() => ({})) as AdminCredits & { error?: string }
      if (!response.ok) {
        setError('')
        setData({ dailyAllowance: 0, profiles: [] })
        if (syncAllowanceInput) setDailyInput('0')
        return
      }
      setError('')
      setData({ dailyAllowance: result.dailyAllowance ?? 0, profiles: Array.isArray(result.profiles) ? result.profiles : [] })
      if (syncAllowanceInput) setDailyInput(String(result.dailyAllowance ?? 0))
    } catch {
      setError('')
      setData({ dailyAllowance: 0, profiles: [] })
      if (syncAllowanceInput) setDailyInput('0')
    }
  }
  useEffect(() => {
    void load(true)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(false) }, 3000)
    return () => window.clearInterval(timer)
  }, [])

  const update = async (method: 'PUT' | 'POST', body: object) => {
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/admin/credits', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'Could not update credits.')
      if (method === 'PUT') setMessage(`Free daily credits set to ${result.dailyAllowance} for all users. Applies on the next Manila midnight reset.`)
      else setMessage(`Sent ${result.addedCredits} bonus credits to ${result.accountsUpdated} accounts.`)
      await load(true)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update credits.') }
    finally { setBusy(false) }
  }

  const setDaily = () => {
    const amount = Number(dailyInput)
    if (!Number.isInteger(amount) || amount < 0) { setError('Enter a whole number of 0 or more.'); return }
    void update('PUT', { dailyAllowance: amount })
  }
  const openGrantConfirm = () => {
    const amount = Number(grantInput)
    if (!Number.isInteger(amount) || amount < 1) { setError('Enter a whole number of 1 or more.'); return }
    setError('')
    setConfirmGrant(amount)
  }
  const confirmGrantAll = () => {
    if (confirmGrant == null) return
    const amount = confirmGrant
    setConfirmGrant(null)
    setGrantInput('')
    void update('POST', { addCredits: amount })
  }

  return <section className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
    <div>
      <h3 className="flex items-center gap-2 font-semibold"><Users className="size-4" /> Listener accounts & credits</h3>
      <p className="mt-1 text-xs text-muted-foreground">15 credits per song request (30 for 2 songs). Free daily credits apply to all users every Manila midnight. Balances auto-refresh every 3 seconds.</p>
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="daily-credit-allowance">Free daily credits per user</Label>
      <div className="flex gap-2">
        <Input id="daily-credit-allowance" type="number" min="0" max="1000000" step="1" value={dailyInput} onChange={(event) => setDailyInput(event.target.value)} disabled={busy} />
        <Button type="button" variant="secondary" onClick={setDaily} disabled={busy}>Set daily</Button>
      </div>
      <p className="text-xs text-muted-foreground">Enter the amount (e.g. 30 = 2 free songs/day). Applies to all users on the next daily reset (Manila time).</p>
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="add-credit-all">Send bonus credits to all users</Label>
      <div className="flex gap-2">
        <Input id="add-credit-all" type="number" min="1" max="1000000" step="1" value={grantInput} onChange={(event) => setGrantInput(event.target.value)} placeholder="Amount" disabled={busy} />
        <Button type="button" onClick={openGrantConfirm} disabled={busy || !grantInput}><Gift />Send to all</Button>
      </div>
      <p className="text-xs text-muted-foreground">Added immediately as bonus credits for every registered account (not a daily reset).</p>
    </div>
    <div className="flex items-center justify-between">
      <h4 className="text-sm font-medium">Users ({data?.profiles.length ?? 0})</h4>
      <Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={busy}><RefreshCw className="size-3.5" />Refresh</Button>
    </div>
    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-background/50 p-2">
      {data?.profiles.map((profile) => (
        <div key={profile.user_id} className="flex items-center justify-between gap-3 border-b border-border/60 px-2 py-2 last:border-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile.display_name || profile.email || 'Listener'}</p>
            <p className="truncate text-[11px] text-muted-foreground">{profile.email}</p>
          </div>
          <p className="shrink-0 text-right text-xs tabular-nums">
            {profile.daily_credits + profile.bonus_credits}
            <span className="block text-[10px] text-muted-foreground">daily {profile.daily_credits} · bonus {profile.bonus_credits}</span>
          </p>
        </div>
      ))}
      {data && data.profiles.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">No linked devices / users yet.</p>}
      {!data && !error && <p className="p-3 text-center text-xs text-muted-foreground">Loading account list…</p>}
    </div>
    {message && <p className="rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-200" role="status">{message}</p>}
    {error && <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive" role="alert">{error}</p>}

    {confirmGrant != null && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmGrant(null) }}>
        <div role="dialog" aria-modal="true" aria-labelledby="grant-confirm-title" className="w-full max-w-sm rounded-2xl border border-primary/30 bg-card p-5 shadow-2xl">
          <h3 id="grant-confirm-title" className="text-base font-semibold">Send bonus credits?</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add <strong className="text-foreground">{confirmGrant}</strong> bonus credits to each of{' '}
            <strong className="text-foreground">{data?.profiles.length ?? 0}</strong> registered accounts?
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirmGrant(null)}>Cancel</Button>
            <Button type="button" disabled={busy} onClick={confirmGrantAll}>
              <Gift className="size-4" /> Confirm send
            </Button>
          </div>
        </div>
      </div>
    )}
  </section>
}
