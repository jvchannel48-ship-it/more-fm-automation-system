'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleUserRound, LogOut, Smartphone, Upload, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ensureDeviceSession } from '@/lib/device-id'

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

  // Auto-bind this phone/browser — no create account form.
  useEffect(() => {
    let active = true
    const boot = async () => {
      setProfileLoading(true)
      try {
        let ok = await refreshProfile(false)
        if (!ok && active) {
          await ensureDeviceSession()
          ok = await refreshProfile(false)
        }
      } finally {
        if (active) setProfileLoading(false)
      }
    }
    void boot()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshProfile(false)
    }, 3000)
    return () => { active = false; window.clearInterval(timer) }
  }, [refreshProfile])

  useEffect(() => {
    const openAccount = () => { setOpen(true); setError(''); setMessage('') }
    window.addEventListener('morefm:open-account', openAccount)
    return () => window.removeEventListener('morefm:open-account', openAccount)
  }, [])

  const updateName = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await readJson(await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: name }) })) as { displayName: string }
      setProfile((current) => current ? { ...current, displayName: result.displayName } : current)
      setMessage('Na-save ang pangalan.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi na-save ang pangalan.') }
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

  const reconnectDevice = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const ok = await ensureDeviceSession()
      if (!ok) throw new Error('Hindi ma-link ang phone device. Subukan ulit.')
      await refreshProfile(true)
      setMessage('Linked na ang phone device mo. Ready na ang free daily credits.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi ma-link ang device.') }
    finally { setBusy(false) }
  }

  const logout = async () => {
    setBusy(true)
    try {
      await fetch('/api/account/session', { method: 'DELETE' })
      profileRef.current = null
      setProfile(null)
      setMessage('Naka-log out. I-tap ang “Use this phone” para i-link ulit.')
    } finally { setBusy(false) }
  }

  const isDeviceAccount = Boolean(profile?.email?.endsWith('@device.local'))

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Account and profile" onClick={() => { setOpen(true); setError(''); setMessage('') }} className="relative">
        {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="size-7 rounded-full object-cover" /> : <CircleUserRound aria-hidden="true" />}
        {profile && <span className="absolute bottom-1 right-1 size-2 rounded-full bg-emerald-500 ring-2 ring-background" aria-label="Logged in" />}
      </Button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="account-title" className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-primary/25 bg-card p-6 text-left shadow-2xl">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Close account" onClick={() => setOpen(false)} className="absolute right-4 top-4"><X /></Button>
            <h2 id="account-title" className="pr-8 text-xl font-semibold">Phone profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">Walang create account. Automatic sa device ng phone mo ang credits.</p>
            {profile ? (
              <div className="mt-5 flex flex-col gap-5">
                <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
                  {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile" className="size-14 rounded-full object-cover" /> : <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary"><UserRound /></span>}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{profile.displayName || 'Phone listener'}</p>
                    <p className="truncate text-xs text-muted-foreground">{isDeviceAccount ? 'Linked to this phone' : profile.email}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <p className="text-xs text-muted-foreground">Your credits · live update</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{profile.creditsRemaining}</p>
                  <p className="text-xs text-muted-foreground">{profile.dailyCredits} daily + {profile.bonusCredits} bonus · free daily {profile.dailyAllowance}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-name">Display name</Label>
                  <div className="flex gap-2">
                    <Input id="profile-name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
                    <Button type="button" variant="secondary" onClick={updateName} disabled={busy || !name.trim()}>Save</Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-avatar">Profile picture (JPEG/PNG/WebP, max 1 MB)</Label>
                  <input id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAvatar(event.target.files?.[0] ?? null)} className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground" />
                  <Button type="button" variant="outline" onClick={uploadAvatar} disabled={busy || !avatar}><Upload />Upload photo</Button>
                </div>
                <Button type="button" variant="outline" onClick={logout} disabled={busy}><LogOut />Disconnect this phone</Button>
              </div>
            ) : profileLoading ? (
              <p className="mt-5 text-sm text-muted-foreground" role="status">Linking this phone…</p>
            ) : (
              <div className="mt-5 flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">I-tap para i-link ang phone na ito. Free daily credits at song requests ay sa device na ito.</p>
                <Button type="button" onClick={reconnectDevice} disabled={busy}>
                  <Smartphone />{busy ? 'Linking…' : 'Use this phone'}
                </Button>
              </div>
            )}
            {message && <p className="mt-4 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-200" role="status">{message}</p>}
            {error && <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
          </section>
        </div>
      )}
    </>
  )
}
