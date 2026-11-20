'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleUserRound, LogOut, ShieldCheck, Smartphone, Upload, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ensureDeviceSession } from '@/lib/device-id'

type UsagePoint = { date: string; creditsUsed: number; requests: number }
type MonthlyUsage = { credits_used: number; requests_count: number }
type Profile = { id: string; email: string; displayName: string; avatarUrl: string | null; creditsEnabled: boolean; dailyCredits?: number; bonusCredits?: number; dailyAllowance?: number; creditsRemaining?: number; usage?: UsagePoint[]; monthlyUsage?: MonthlyUsage }
type View = 'profile' | 'usage' | 'privacy'

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'Hindi nagtagumpay ang account request.')
  return data
}

function UsageChart({ usage }: { usage: UsagePoint[] }) {
  const slots = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => {
    const found = usage.find((item) => {
      const day = new Date(`${item.date}T00:00:00+08:00`).getUTCDay()
      return ((day + 6) % 7) === index
    })
    return { label, value: found?.creditsUsed ?? 0 }
  })
  const max = Math.max(15, ...slots.map((slot) => slot.value))
  const points = slots.map((slot, index) => `${index * 20 + 5},${62 - (slot.value / max) * 50}`).join(' ')
  return (
    <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
      <svg viewBox="0 0 110 70" className="h-28 w-full overflow-visible" role="img" aria-label="Credit usage from Monday to Saturday">
        <defs><linearGradient id="usage-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#34d399" stopOpacity=".25" /><stop offset="1" stopColor="#34d399" stopOpacity="0" /></linearGradient></defs>
        <path d={`M 5 62 L ${points} L 105 62 Z`} fill="url(#usage-fill)" />
        <polyline points={points} fill="none" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {slots.map((slot, index) => <circle key={slot.label} cx={index * 20 + 5} cy={62 - (slot.value / max) * 50} r="1.8" fill="#a7f3d0" />)}
      </svg>
      <div className="grid grid-cols-6 text-center text-[10px] text-muted-foreground">{slots.map((slot) => <span key={slot.label}>{slot.label}<br /><b className="text-emerald-300">{slot.value}</b></span>)}</div>
    </div>
  )
}

export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('profile')
  const [profile, setProfile] = useState<Profile | null>(null)
  const profileRef = useRef<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refreshProfile = useCallback(async (showError = false) => {
    try {
      const response = await fetch('/api/account/profile', { cache: 'no-store' })
      const data = await response.json().catch(() => ({})) as Profile & { error?: string }
      if (response.status === 401) { profileRef.current = null; setProfile(null); return false }
      if (!response.ok) throw new Error(data.error ?? 'Hindi ma-load ang profile.')
      setProfile(data)
      if (!profileRef.current || profileRef.current.id !== data.id) setName(data.displayName)
      profileRef.current = data
      return true
    } catch (reason) {
      if (showError) setError(reason instanceof Error ? reason.message : 'Hindi ma-load ang account.')
      return false
    }
  }, [])

  useEffect(() => {
    let active = true
    const boot = async () => {
      setProfileLoading(true)
      try {
        let ok = await refreshProfile(false)
        if (!ok && active) { await ensureDeviceSession(); ok = await refreshProfile(false) }
      } finally { if (active) setProfileLoading(false) }
    }
    void boot()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshProfile(false) }, 3000)
    return () => { active = false; window.clearInterval(timer) }
  }, [refreshProfile])

  useEffect(() => {
    const openAccount = () => { setOpen(true); setView('profile'); setError(''); setMessage('') }
    window.addEventListener('morefm:open-account', openAccount)
    return () => window.removeEventListener('morefm:open-account', openAccount)
  }, [])

  const updateName = async () => {
    setBusy(true); setError(''); setMessage('')
    try { const result = await readJson(await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: name }) })) as { displayName: string }; setProfile((current) => current ? { ...current, displayName: result.displayName } : current); setMessage('Na-save ang pangalan.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi na-save ang pangalan.') }
    finally { setBusy(false) }
  }

  const uploadAvatar = async () => {
    if (!avatar) return
    setBusy(true); setError(''); setMessage('')
    try { const form = new FormData(); form.set('avatar', avatar); const result = await readJson(await fetch('/api/account/avatar', { method: 'POST', body: form })) as { avatarUrl: string }; setProfile((current) => current ? { ...current, avatarUrl: result.avatarUrl } : current); setAvatar(null); setMessage('Na-update ang profile picture.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi na-upload ang larawan.') }
    finally { setBusy(false) }
  }

  const reconnectDevice = async () => {
    setBusy(true); setError(''); setMessage('')
    try { if (!await ensureDeviceSession()) throw new Error('Hindi ma-link ang phone device. Subukan ulit.'); await refreshProfile(true); setMessage('Handa na ang profile mo para sa daily credits.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi ma-link ang device.') }
    finally { setBusy(false) }
  }

  const logout = async () => { setBusy(true); try { await fetch('/api/account/session', { method: 'DELETE' }); profileRef.current = null; setProfile(null); setMessage('Naka-disconnect ang profile sa phone na ito.') } finally { setBusy(false) } }
  const openView = (next: View) => { setView(next); setError(''); setMessage('') }

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Account and profile" onClick={() => { setOpen(true); setView('profile'); setError(''); setMessage('') }} className="relative">
        {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="size-7 rounded-full object-cover" /> : <CircleUserRound aria-hidden="true" />}
        {profile && <span className="absolute bottom-1 right-1 size-2 rounded-full bg-emerald-500 ring-2 ring-background" aria-label="Logged in" />}
      </Button>
      {open && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="account-title" className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-primary/25 bg-card p-6 text-left shadow-2xl">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close account" onClick={() => setOpen(false)} className="absolute right-4 top-4"><X /></Button>
          <h2 id="account-title" className="pr-8 text-xl font-semibold">Phone profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage your listener profile and credits.</p>
          {profile ? <div className="mt-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile" className="size-14 rounded-full object-cover" /> : <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary"><UserRound /></span>}
              <div className="min-w-0"><p className="truncate font-medium">{profile.displayName || 'Listener'}</p><p className="truncate text-xs text-muted-foreground">Your RJ FM profile</p></div>
            </div>
            {profile.creditsEnabled && <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Available</p><p className="mt-1 text-2xl font-bold tabular-nums">{profile.creditsRemaining}</p><p className="text-[11px] text-muted-foreground">credits</p></div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3"><p className="text-xs text-muted-foreground">Today</p><p className="mt-1 text-2xl font-bold tabular-nums">{profile.dailyCredits}</p><p className="text-[11px] text-muted-foreground">of {profile.dailyAllowance} · resets daily</p></div>
            </div>}
            <div className="flex gap-2"><Button type="button" variant={view === 'profile' ? 'secondary' : 'outline'} className="flex-1" onClick={() => openView('profile')}>Profile</Button>{profile.creditsEnabled && <Button type="button" variant={view === 'usage' ? 'secondary' : 'outline'} className="flex-1" onClick={() => openView('usage')}>Credits usage</Button>}<Button type="button" variant={view === 'privacy' ? 'secondary' : 'outline'} size="icon" aria-label="Privacy policy" onClick={() => openView('privacy')}><ShieldCheck /></Button></div>
            {!profile.creditsEnabled ? <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">Credit features are currently unavailable.</div> : view === 'usage' ? <div className="rounded-2xl border p-4"><p className="font-medium">Weekly activity</p><p className="mt-1 text-xs text-muted-foreground">Credits used this week, Monday to Saturday.</p><UsageChart usage={profile.usage ?? []} /><div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 p-3"><p className="text-xs font-medium">This month</p><div className="mt-2 grid grid-cols-2 gap-2"><div><p className="text-xl font-bold tabular-nums">{profile.monthlyUsage?.credits_used ?? 0}</p><p className="text-[11px] text-muted-foreground">credits used</p></div><div><p className="text-xl font-bold tabular-nums">{profile.monthlyUsage?.requests_count ?? 0}</p><p className="text-[11px] text-muted-foreground">song requests</p></div></div></div><p className="mt-3 text-xs text-muted-foreground">Daily credits reset at midnight Philippine time. Extra credits remain available separately.</p></div> : view === 'privacy' ? <div className="rounded-2xl border p-4 text-sm leading-6"><p className="font-medium">Privacy policy</p><p className="mt-2 text-muted-foreground">RJ FM keeps the profile details needed to save your preferences, credits, and request history. Your profile is tied to this phone session so another device cannot use its balance.</p><p className="mt-2 text-muted-foreground">Listening activity is used only to show current listener status in the admin panel. It expires shortly after playback stops. We do not display your private profile information to other listeners.</p></div> : <>
              <div className="flex flex-col gap-2"><Label htmlFor="profile-name">Display name</Label><div className="flex gap-2"><Input id="profile-name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /><Button type="button" variant="secondary" onClick={updateName} disabled={busy || !name.trim()}>Save</Button></div></div>
              <div className="flex flex-col gap-2"><Label htmlFor="profile-avatar">Profile picture</Label><input id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAvatar(event.target.files?.[0] ?? null)} className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground" /><Button type="button" variant="outline" onClick={uploadAvatar} disabled={busy || !avatar}><Upload />Upload photo</Button></div>
              <Button type="button" variant="outline" onClick={logout} disabled={busy}><LogOut />Disconnect this phone</Button>
            </>}
          </div> : profileLoading ? <p className="mt-5 text-sm text-muted-foreground" role="status">Preparing your profile…</p> : <div className="mt-5 flex flex-col gap-4"><p className="text-sm text-muted-foreground">Link this phone to keep your profile and daily credits together.</p><Button type="button" onClick={reconnectDevice} disabled={busy}><Smartphone />{busy ? 'Linking…' : 'Use this phone'}</Button></div>}
          {message && <p className="mt-4 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-200" role="status">{message}</p>}{error && <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
        </section>
      </div>}
    </>
  )
}
