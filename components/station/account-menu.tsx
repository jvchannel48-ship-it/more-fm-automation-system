'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleUserRound, LogIn, LogOut, Upload, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Profile = { id: string; email: string; displayName: string; avatarUrl: string | null; dailyCredits: number; bonusCredits: number; dailyAllowance: number; creditsRemaining: number }

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'Hindi nagtagumpay ang account request.')
  return data
}

export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const profileRef = useRef<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [currentEmailPassword, setCurrentEmailPassword] = useState('')
  const [currentChangePassword, setCurrentChangePassword] = useState('')
  const [name, setName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refreshProfile = useCallback(async (showError = false) => {
    try {
      const response = await fetch('/api/account/profile', { cache: 'no-store' })
      const data = await response.json().catch(() => ({})) as Profile & { error?: string }
      if (response.status === 401) { profileRef.current = null; setProfile(null); return }
      if (!response.ok) throw new Error(data.error ?? 'Hindi ma-load ang profile.')
      setProfile(data)
      if (!profileRef.current || profileRef.current.id !== data.id) {
        setName(data.displayName)
        setNewEmail(data.email)
      }
      profileRef.current = data
    } catch (reason) {
      if (showError) setError(reason instanceof Error ? reason.message : 'Hindi ma-load ang account.')
    }
  }, [])

  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (!active || document.visibilityState !== 'visible') return
      setProfileLoading(true)
      await refreshProfile(open)
      if (active) setProfileLoading(false)
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 3000)
    return () => { active = false; window.clearInterval(timer) }
  }, [open, refreshProfile])

  useEffect(() => {
    const openAccount = () => { setOpen(true); setError(''); setMessage('') }
    window.addEventListener('morefm:open-account', openAccount)
    return () => window.removeEventListener('morefm:open-account', openAccount)
  }, [])

  const doAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      await readJson(await fetch('/api/account/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, email: email.trim(), password, displayName: name.trim() }),
      }))
      await refreshProfile(true)
      setPassword('')
      setMessage(mode === 'signup' ? 'Account created. Naka-login ka na.' : 'Naka-login na.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi nagtagumpay ang login.') }
    finally { setBusy(false) }
  }

  const updateName = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await readJson(await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: name }) })) as { displayName: string }
      setProfile((current) => current ? { ...current, displayName: result.displayName } : current)
      setMessage('Na-save ang pangalan.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi na-save ang pangalan.') }
    finally { setBusy(false) }
  }

  const updateSecurity = async (action: 'email' | 'password') => {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await readJson(await fetch('/api/account/security', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, currentPassword: action === 'email' ? currentEmailPassword : currentChangePassword, newEmail: newEmail.trim(), newPassword }),
      })) as { email?: string; message?: string }
      if (result.email) setProfile((current) => current ? { ...current, email: result.email! } : current)
      setCurrentEmailPassword(''); setCurrentChangePassword(''); setNewPassword('')
      setMessage(result.message ?? (action === 'email' ? 'Na-update ang email.' : 'Na-update ang password.'))
      if (action === 'email' && result.email) { setNewEmail(result.email); profileRef.current = profileRef.current ? { ...profileRef.current, email: result.email } : null }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi na-update ang account.') }
    finally { setBusy(false) }
  }

  const uploadAvatar = async () => {
    if (!avatar) return
    setBusy(true); setError(''); setMessage('')
    try {
      const form = new FormData(); form.set('avatar', avatar)
      const result = await readJson(await fetch('/api/account/avatar', { method: 'POST', body: form })) as { avatarUrl: string }
      setProfile((current) => current ? { ...current, avatarUrl: result.avatarUrl } : current)
      setAvatar(null); setMessage('Na-update ang profile picture.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi na-upload ang larawan.') }
    finally { setBusy(false) }
  }

  const logout = async () => {
    setBusy(true)
    try { await fetch('/api/account/session', { method: 'DELETE' }); profileRef.current = null; setProfile(null); setMessage('Naka-log out ka na.'); setPassword('') }
    finally { setBusy(false) }
  }

  return <>
    <Button variant="ghost" size="icon" aria-label="Account and profile" onClick={() => { setOpen(true); setError(''); setMessage('') }} className="relative">
      {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="size-7 rounded-full object-cover" /> : <CircleUserRound aria-hidden="true" />}
      {profile && <span className="absolute bottom-1 right-1 size-2 rounded-full bg-emerald-500 ring-2 ring-background" aria-label="Logged in" />}
    </Button>
    {open && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="account-title" className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-primary/25 bg-card p-6 text-left shadow-2xl">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close account" onClick={() => setOpen(false)} className="absolute right-4 top-4"><X /></Button>
        <h2 id="account-title" className="pr-8 text-xl font-semibold">Profile & account</h2>
        {profile ? <div className="mt-5 flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile" className="size-14 rounded-full object-cover" /> : <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary"><UserRound /></span>}
            <div className="min-w-0"><p className="truncate font-medium">{profile.displayName || 'Listener'}</p><p className="truncate text-xs text-muted-foreground">{profile.email}</p></div>
          </div>
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground">Your credits · live update</p><p className="mt-1 text-2xl font-bold tabular-nums">{profile.creditsRemaining}</p>
            <p className="text-xs text-muted-foreground">{profile.dailyCredits} daily + {profile.bonusCredits} bonus · {profile.dailyAllowance} daily credits</p>
          </div>
          <div className="flex flex-col gap-2"><Label htmlFor="profile-name">Name</Label><div className="flex gap-2"><Input id="profile-name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /><Button type="button" variant="secondary" onClick={updateName} disabled={busy || !name.trim()}>Save</Button></div></div>
          <div className="flex flex-col gap-2"><Label htmlFor="profile-email">Change email</Label><Input id="profile-email" type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /><Input aria-label="Current password to change email" type="password" autoComplete="current-password" placeholder="Current password" value={currentEmailPassword} onChange={(event) => setCurrentEmailPassword(event.target.value)} /><Button type="button" variant="secondary" onClick={() => updateSecurity('email')} disabled={busy || !newEmail.trim() || newEmail.trim() === profile.email || !currentEmailPassword}>Update email</Button></div>
          <div className="flex flex-col gap-2"><Label htmlFor="profile-password">Change password</Label><Input aria-label="Current password to change password" type="password" autoComplete="current-password" placeholder="Current password" value={currentChangePassword} onChange={(event) => setCurrentChangePassword(event.target.value)} /><Input id="profile-password" type="password" autoComplete="new-password" placeholder="New password (at least 8 characters)" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><Button type="button" variant="secondary" onClick={() => updateSecurity('password')} disabled={busy || newPassword.length < 8 || !currentChangePassword}>Update password</Button></div>
          <div className="flex flex-col gap-2"><Label htmlFor="profile-avatar">Profile picture (JPEG/PNG/WebP, max 1 MB)</Label><input id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAvatar(event.target.files?.[0] ?? null)} className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground" /><Button type="button" variant="outline" onClick={uploadAvatar} disabled={busy || !avatar}><Upload />Upload photo</Button></div>
          <Button type="button" variant="outline" onClick={logout} disabled={busy}><LogOut />Log out</Button>
        </div> : profileLoading ? <p className="mt-5 text-sm text-muted-foreground" role="status">Checking account…</p> : <form onSubmit={doAuth} className="mt-5 flex flex-col gap-4">
          {mode === 'signup' && <div className="flex flex-col gap-2"><Label htmlFor="account-name">Name</Label><Input id="account-name" maxLength={60} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></div>}
          <div className="flex flex-col gap-2"><Label htmlFor="account-email">Email</Label><Input id="account-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="account-password">Password</Label><Input id="account-password" type="password" minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
          <Button type="submit" disabled={busy || !email || password.length < 8}><LogIn />{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}</Button>
          <Button type="button" variant="ghost" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}>{mode === 'login' ? 'Create a new account' : 'Already have an account? Log in'}</Button>
        </form>}
        {message && <p className="mt-4 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-200" role="status">{message}</p>}
        {error && <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
      </section>
    </div>}
  </>
}
