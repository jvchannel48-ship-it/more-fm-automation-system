'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BatteryCharging, CircleUserRound, LogOut, Mic, Share2, ShieldCheck, Smartphone, Upload, UserRound, X, Settings, RefreshCw, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ensureDeviceSession } from '@/lib/device-id'

type UsagePoint = { date: string; creditsUsed: number; requests: number }
type MonthlyUsage = { credits_used: number; requests_count: number }
type Profile = { id: string; email: string; displayName: string; avatarUrl: string | null; creditsEnabled: boolean; dailyCredits?: number; bonusCredits?: number; dailyAllowance?: number; creditsRemaining?: number; usage?: UsagePoint[]; monthlyUsage?: MonthlyUsage }
type View = 'profile' | 'usage' | 'privacy' | 'permissions' | 'settings'

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'Hindi nagtagumpay ang account request.')
  return data
}

function UsageChart({ usage }: { usage: UsagePoint[] }) {
  const slots = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => {
    const found = usage.find((item) => {
      const day = new Date(`${item.date}T00:00:00+08:00`).getUTCDay()
      return ((day + 6) % 7) === index
    })
    return { label, value: found?.creditsUsed ?? 0 }
  })
  const max = Math.max(15, ...slots.map((slot) => slot.value))
  const points = slots.map((slot, index) => `${index * 16 + 5},${62 - (slot.value / max) * 50}`).join(' ')
  return (
    <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
      <svg viewBox="0 0 110 70" className="h-28 w-full overflow-visible" role="img" aria-label="Credit usage from Monday to Sunday">
        <defs><linearGradient id="usage-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#34d399" stopOpacity=".25" /><stop offset="1" stopColor="#34d399" stopOpacity="0" /></linearGradient></defs>
        <path d={`M 5 62 L ${points} L 101 62 Z`} fill="url(#usage-fill)" />
        <polyline points={points} fill="none" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {slots.map((slot, index) => <circle key={slot.label} cx={index * 16 + 5} cy={62 - (slot.value / max) * 50} r="1.8" fill="#a7f3d0" />)}
      </svg>
      <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground">{slots.map((slot) => <span key={slot.label}>{slot.label}<br /><b className="text-emerald-300">{slot.value}</b></span>)}</div>
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
  const [permissionBusy, setPermissionBusy] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'unknown'>('unknown')
  const [updating, setUpdating] = useState(false)

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
    const openSettings = () => { setOpen(true); setView('settings'); setError(''); setMessage('') }
    window.addEventListener('morefm:open-account', openAccount)
    window.addEventListener('morefm:open-settings', openSettings)
    return () => { window.removeEventListener('morefm:open-account', openAccount); window.removeEventListener('morefm:open-settings', openSettings) }
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

  const shareAppLink = async () => {
    const apkUrl = 'https://github.com/jvchannel48-ship-it/more-fm-automation-system/releases/download/android-latest/rj-fm-android.apk'
    const shareData = {
      title: 'RJ FM Android App',
      text: 'I-download ang RJ FM Android app gamit ang link na ito:',
      url: apkUrl,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
        setMessage('Naibahagi ang RJ FM APK link.')
        setError('')
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(apkUrl)
        setMessage('Nakopya ang RJ FM APK link. Maaari mo na itong ipadala sa iba.')
        setError('')
        return
      }
      window.prompt('Kopyahin ang RJ FM APK link:', apkUrl)
    } catch (reason) {
      if (reason instanceof Error && reason.name === 'AbortError') return
      setError('Hindi naibahagi ang link. Subukan ulit.')
    }
  }

  const enableNotifications = async () => {
    setPermissionBusy(true); setError(''); setMessage('')
    try {
      const { requestPushPermission } = await import('@/lib/app-permissions')
      const granted = await requestPushPermission()
      setPermissionStatus(granted ? 'granted' : 'denied')
      setMessage(granted ? 'Pinayagan ang RJ FM notifications.' : 'Hindi pinayagan ang notifications. Maaari itong baguhin sa Android Settings.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hindi ma-enable ang notifications.')
    } finally { setPermissionBusy(false) }
  }

  const enableBatteryOptimization = async () => {
    setPermissionBusy(true); setError(''); setMessage('')
    try {
      const { requestBatteryOptimizationExemption } = await import('@/lib/app-permissions')
      await requestBatteryOptimizationExemption()
      setMessage('Binuksan ang Android battery optimization settings para payagan ang RJ FM.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hindi mabuksan ang battery settings.')
    } finally { setPermissionBusy(false) }
  }

  const enableMicrophone = async () => {
    setPermissionBusy(true); setError(''); setMessage('')
    try {
      const { requestMicrophonePermission } = await import('@/lib/app-permissions')
      await requestMicrophonePermission()
      setMessage('Pinayagan ang microphone para sa mga feature na nangangailangan nito.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hindi ma-enable ang microphone.')
    } finally { setPermissionBusy(false) }
  }

  const reconnectDevice = async () => {
    setBusy(true); setError(''); setMessage('')
    try { if (!await ensureDeviceSession()) throw new Error('Hindi ma-link ang phone device. Subukan ulit.'); await refreshProfile(true); setMessage('Handa na ang profile mo para sa daily credits.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Hindi ma-link ang device.') }
    finally { setBusy(false) }
  }

  const logout = async () => { setBusy(true); try { await fetch('/api/account/session', { method: 'DELETE' }); profileRef.current = null; setProfile(null); setMessage('Naka-disconnect ang profile sa phone na ito.') } finally { setBusy(false) } }

  const updateApp = async () => {
    setUpdating(true)
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
      }
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.map((name) => caches.delete(name)))
      }
    } finally {
      const url = new URL(window.location.href)
      url.searchParams.set('app_update', String(Date.now()))
      window.location.replace(url.toString())
    }
  }

  const openView = (next: View) => { setView(next); setError(''); setMessage('') }

  return (
    <>
            {open && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="account-title" className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-primary/25 bg-card p-6 text-left shadow-2xl">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close account" onClick={() => setOpen(false)} className="absolute right-4 top-4"><X /></Button>
          <h2 id="account-title" className="pr-8 text-xl font-semibold">Phone profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">Profile, playback, permissions, at app settings.</p>
          {profile ? <div className="mt-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile" className="size-14 rounded-full object-cover" /> : <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary"><UserRound /></span>}
              <div className="min-w-0"><p className="truncate font-medium">{profile.displayName || 'Listener'}</p><p className="truncate text-xs text-muted-foreground">Your RJ FM profile</p></div>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={shareAppLink}><Share2 className="size-4" />Share RJ FM APK link</Button>
            <p className="text-xs text-muted-foreground">Ipadala ang opisyal na link para ma-download o ma-update ng iba ang RJ FM app.</p>
            {profile.creditsEnabled && <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Available</p><p className="mt-1 text-2xl font-bold tabular-nums">{profile.creditsRemaining}</p><p className="text-[11px] text-muted-foreground">credits</p></div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3"><p className="text-xs text-muted-foreground">Today</p><p className="mt-1 text-2xl font-bold tabular-nums">{profile.dailyCredits}</p><p className="text-[11px] text-muted-foreground">of {profile.dailyAllowance} · resets daily</p></div>
            </div>}
            <div className="flex gap-2"><Button type="button" variant={view === 'profile' ? 'secondary' : 'outline'} className="flex-1" onClick={() => openView('profile')}>Profile</Button><Button type="button" variant={view === 'settings' ? 'secondary' : 'outline'} className="flex-1" onClick={() => openView('settings')}><Settings className="size-4" />Settings</Button>{profile.creditsEnabled && <Button type="button" variant={view === 'usage' ? 'secondary' : 'outline'} className="flex-1" onClick={() => openView('usage')}>Credits usage</Button>}<Button type="button" variant={view === 'permissions' ? 'secondary' : 'outline'} size="icon" aria-label="App permissions" onClick={() => openView('permissions')}><Bell /></Button><Button type="button" variant={view === 'privacy' ? 'secondary' : 'outline'} size="icon" aria-label="Privacy policy" onClick={() => openView('privacy')}><ShieldCheck /></Button></div>
            {view === 'usage' && !profile.creditsEnabled ? <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">Credit features are currently unavailable.</div> : view === 'usage' ? <div className="rounded-2xl border p-4"><p className="font-medium">Weekly activity</p><p className="mt-1 text-xs text-muted-foreground">Credits used this week, Monday to Sunday.</p><UsageChart usage={profile.usage ?? []} /><div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 p-3"><p className="text-xs font-medium">This month</p><div className="mt-2 grid grid-cols-2 gap-2"><div><p className="text-xl font-bold tabular-nums">{profile.monthlyUsage?.credits_used ?? 0}</p><p className="text-[11px] text-muted-foreground">credits used</p></div><div><p className="text-xl font-bold tabular-nums">{profile.monthlyUsage?.requests_count ?? 0}</p><p className="text-[11px] text-muted-foreground">song requests</p></div></div></div><p className="mt-3 text-xs text-muted-foreground">Daily credits reset at midnight Philippine time. Extra credits remain available separately.</p></div> : view === 'settings' ? <div className="flex flex-col gap-3 rounded-2xl border p-4"><div><p className="font-medium">App settings</p><p className="mt-1 text-xs text-muted-foreground">Manage app permissions and refresh the latest version.</p></div><Button type="button" variant="outline" className="w-full" onClick={() => openView('permissions')}><ShieldCheck className="size-4" />App permissions</Button><div className="rounded-xl bg-secondary/50 p-3"><p className="text-sm font-medium">Update RJ FM</p><p className="mt-1 text-xs text-muted-foreground">Refresh app files and load the latest available version.</p><Button type="button" className="mt-3 w-full" onClick={updateApp} disabled={updating}>{updating ? <RefreshCw className="animate-spin" /> : <Check />}{updating ? 'Updating…' : 'Update app'}</Button></div></div> : view === 'permissions' ? <div className="flex flex-col gap-3 rounded-2xl border p-4">
                <div><p className="font-medium">App permissions</p><p className="mt-1 text-xs text-muted-foreground">Piliin kung aling access ang ibibigay sa RJ FM. Hihingi lang ng pahintulot kapag pinindot mo ang button.</p></div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 p-3"><div className="flex items-center gap-2"><Bell className="size-4 text-primary" /><div><p className="text-sm font-medium">Notifications</p><p className="text-xs text-muted-foreground">RJ FM alerts via OneSignal</p></div></div><Button type="button" size="sm" onClick={enableNotifications} disabled={permissionBusy}>Allow</Button></div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 p-3"><div className="flex items-center gap-2"><Mic className="size-4 text-primary" /><div><p className="text-sm font-medium">Microphone</p><p className="text-xs text-muted-foreground">For voice features when used</p></div></div><Button type="button" size="sm" variant="outline" onClick={enableMicrophone} disabled={permissionBusy}>Allow</Button></div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 p-3"><div className="flex items-center gap-2"><BatteryCharging className="size-4 text-primary" /><div><p className="text-sm font-medium">Battery optimization</p><p className="text-xs text-muted-foreground">Allow background playback</p></div></div><Button type="button" size="sm" variant="outline" onClick={enableBatteryOptimization} disabled={permissionBusy}>Settings</Button></div>
                <p className="text-xs text-muted-foreground">Maaari mo ring baguhin o bawiin ang permissions sa Android Settings → Apps → RJ FM → Permissions.</p>
              </div> : view === 'privacy' ? <div className="rounded-2xl border p-4 text-sm leading-6"><p className="font-medium">Privacy policy</p><p className="mt-2 text-muted-foreground">RJ FM keeps the profile details needed to save your preferences, credits, and request history. Your profile is tied to this phone session so another device cannot use its balance.</p><p className="mt-2 text-muted-foreground">Listening activity is used only to show current listener status in the admin panel. It expires shortly after playback stops. We do not display your private profile information to other listeners.</p></div> : <>
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
