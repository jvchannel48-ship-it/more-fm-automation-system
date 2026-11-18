'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CircleUserRound, LogIn, LogOut, Upload, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

type Profile = { id: string; email: string; displayName: string; avatarUrl: string | null; dailyCredits: number; bonusCredits: number; dailyAllowance: number; creditsRemaining: number }

export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let client: ReturnType<typeof getSupabaseBrowserClient>
    try {
      client = getSupabaseBrowserClient()
      void client.auth.getSession().then(({ data }) => setSession(data.session))
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => setSession(next))
      return () => subscription.unsubscribe()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Account login is not configured.')
    }
  }, [])

  useEffect(() => {
    if (!session?.access_token) { setProfile(null); setProfileLoading(false); return }
    let active = true
    setProfileLoading(true)
    void fetch('/api/account/profile', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error ?? 'Hindi ma-load ang profile.')
        if (active) { setProfile(data as Profile); setName((data as Profile).displayName); setNewEmail((data as Profile).email) }
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Hindi ma-load ang profile.') })
      .finally(() => { if (active) setProfileLoading(false) })
    return () => { active = false }
  }, [session?.access_token])

  useEffect(() => {
    const openAccount = () => setOpen(true)
    window.addEventListener('morefm:open-account', openAccount)
    return () => window.removeEventListener('morefm:open-account', openAccount)
  }, [])

  const doAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const client = getSupabaseBrowserClient()
      if (mode === 'signup') {
        if (name.trim().length < 1 || name.trim().length > 60) throw new Error('Name must be 1–60 characters.')
        const { data, error: authError } = await client.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } })
        if (authError) throw authError
        if (data.session) setSession(data.session)
        else setMessage('Account created. Kung naka-enable ang email confirmation sa Supabase, buksan ang email para kumpirmahin bago mag-login.')
      } else {
        const { data, error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
        setSession(data.session)
        setPassword('')
        setMessage('Naka-login na.')
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi nagtagumpay ang login.') }
    finally { setBusy(false) }
  }

  const updateName = async () => {
    if (!session) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ displayName: name }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'Hindi na-save ang pangalan.')
      setProfile((current) => current ? { ...current, displayName: result.displayName } : current)
      setMessage('Na-save ang pangalan.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi na-save ang pangalan.') }
    finally { setBusy(false) }
  }

  const updatePassword = async () => {
    setError(''); setMessage('')
    if (newPassword.length < 8) { setError('Gumamit ng password na hindi bababa sa 8 characters.'); return }
    setBusy(true)
    try {
      const { error: authError } = await getSupabaseBrowserClient().auth.updateUser({ password: newPassword })
      if (authError) throw authError
      setNewPassword(''); setMessage('Na-update ang password.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi na-update ang password.') }
    finally { setBusy(false) }
  }

  const updateEmail = async () => {
    setError(''); setMessage('')
    if (!newEmail.trim() || newEmail.trim() === profile?.email) { setError('Maglagay ng bagong email address.'); return }
    setBusy(true)
    try {
      const { error: authError } = await getSupabaseBrowserClient().auth.updateUser({ email: newEmail.trim() })
      if (authError) throw authError
      setMessage('Nagpadala ng confirmation sa bagong email. I-confirm ito para makumpleto ang pagbabago.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi na-update ang email.') }
    finally { setBusy(false) }
  }

  const uploadAvatar = async () => {
    if (!session || !avatar) return
    setBusy(true); setError(''); setMessage('')
    try {
      const form = new FormData(); form.set('avatar', avatar)
      const response = await fetch('/api/account/avatar', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: form })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'Hindi na-upload ang larawan.')
      setProfile((current) => current ? { ...current, avatarUrl: result.avatarUrl } : current)
      setAvatar(null); setMessage('Na-update ang profile picture.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi na-upload ang larawan.') }
    finally { setBusy(false) }
  }

  const logout = async () => {
    await getSupabaseBrowserClient().auth.signOut()
    setSession(null); setProfile(null); setMessage('Naka-log out ka na.')
  }

  return <>
    <Button variant="ghost" size="icon" aria-label="Account and profile" onClick={() => { setOpen(true); setError(''); setMessage('') }} className="relative">
      {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="size-7 rounded-full object-cover" /> : <CircleUserRound aria-hidden="true" />}
      {session && <span className="absolute bottom-1 right-1 size-2 rounded-full bg-emerald-500 ring-2 ring-background" aria-label="Logged in" />}
    </Button>
    {open && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="account-title" className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-primary/25 bg-card p-6 text-left shadow-2xl">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close account" onClick={() => setOpen(false)} className="absolute right-4 top-4"><X /></Button>
        <h2 id="account-title" className="pr-8 text-xl font-semibold">Profile & account</h2>
        {session && profile ? <div className="mt-5 flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile" className="size-14 rounded-full object-cover" /> : <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary"><UserRound /></span>}
            <div className="min-w-0"><p className="truncate font-medium">{profile.displayName || 'Listener'}</p><p className="truncate text-xs text-muted-foreground">{profile.email}</p></div>
          </div>
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground">Your credits</p><p className="mt-1 text-2xl font-bold tabular-nums">{profile.creditsRemaining}</p>
            <p className="text-xs text-muted-foreground">{profile.dailyCredits} daily + {profile.bonusCredits} bonus · {profile.dailyAllowance} daily credits</p>
          </div>
          <div className="flex flex-col gap-2"><Label htmlFor="profile-name">Name</Label><div className="flex gap-2"><Input id="profile-name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /><Button type="button" variant="secondary" onClick={updateName} disabled={busy || !name.trim()}>Save</Button></div></div>
          <div className="flex flex-col gap-2"><Label htmlFor="profile-email">Change email</Label><div className="flex gap-2"><Input id="profile-email" type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /><Button type="button" variant="secondary" onClick={updateEmail} disabled={busy || !newEmail.trim() || newEmail.trim() === profile.email}>Update</Button></div><p className="text-xs text-muted-foreground">Supabase may send a confirmation link before applying the new email.</p></div>
          <div className="flex flex-col gap-2"><Label htmlFor="profile-password">Change password</Label><div className="flex gap-2"><Input id="profile-password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><Button type="button" variant="secondary" onClick={updatePassword} disabled={busy || newPassword.length < 8}>Update</Button></div></div>
          <div className="flex flex-col gap-2"><Label htmlFor="profile-avatar">Profile picture (JPEG/PNG/WebP, max 2 MB)</Label><input id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAvatar(event.target.files?.[0] ?? null)} className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground" /><Button type="button" variant="outline" onClick={uploadAvatar} disabled={busy || !avatar}><Upload />Upload photo</Button></div>
          <Button type="button" variant="outline" onClick={logout} disabled={busy}><LogOut />Log out</Button>
        </div> : session && profileLoading ? <p className="mt-5 text-sm text-muted-foreground" role="status">Loading your account…</p> : <form onSubmit={doAuth} className="mt-5 flex flex-col gap-4">
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
