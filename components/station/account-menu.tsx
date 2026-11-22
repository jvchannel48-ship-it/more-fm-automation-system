'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, Bell, BatteryCharging, ExternalLink, Gauge, LogOut, Mic, Share2, ShieldCheck, Smartphone, Upload, UserRound, X, Settings, RefreshCw, Check, Copy, Globe, Info } from 'lucide-react'
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
  const [view, setView] = useState<View>('settings')
  const [profile, setProfile] = useState<Profile | null>(null)
  const profileRef = useRef<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [permissionBusy, setPermissionBusy] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [pingBusy, setPingBusy] = useState(false)
  const [pingSamples, setPingSamples] = useState<number[]>([])
  const [pingError, setPingError] = useState('')
  const [publicIp, setPublicIp] = useState('')
  const [ipBusy, setIpBusy] = useState(false)
  const [ipError, setIpError] = useState('')
  const [ipCopied, setIpCopied] = useState(false)

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
    const openAccount = () => { setOpen(true); setView('settings'); setError(''); setMessage('') }
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

  const runPingTest = async () => {
    setPingBusy(true)
    setPingError('')
    setPingSamples([])
    const samples: number[] = []
    try {
      for (let index = 0; index < 5; index++) {
        const startedAt = performance.now()
        const response = await fetch(`/api/ping?run=${Date.now()}-${index}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Hindi maabot ang RJ FM server.')
        await response.json()
        samples.push(Math.round((performance.now() - startedAt) * 10) / 10)
        setPingSamples([...samples])
      }
    } catch (reason) {
      setPingError(reason instanceof Error ? reason.message : 'Hindi natapos ang ping test.')
    } finally {
      setPingBusy(false)
    }
  }

  const checkPublicIp = async () => {
    setIpBusy(true); setIpError(''); setIpCopied(false)
    try {
      const response = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' })
      if (!response.ok) throw new Error('Hindi makuha ang public IP address.')
      const result = await response.json() as { ip?: string }
      if (!result.ip) throw new Error('Walang IP address na ibinalik ang provider.')
      setPublicIp(result.ip)
    } catch (reason) { setIpError(reason instanceof Error ? reason.message : 'IP check failed.') }
    finally { setIpBusy(false) }
  }

  const copyPublicIp = async () => {
    if (!publicIp) return
    try { await navigator.clipboard.writeText(publicIp); setIpCopied(true) }
    catch { setIpError('Hindi ma-access ang clipboard sa device na ito.') }
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
            
            <Button type="button" variant="outline" className="w-full" onClick={shareAppLink}><Share2 className="size-4" />Share RJ FM APK link</Button>
            <p className="text-xs text-muted-foreground">Ipadala ang opisyal na link para ma-download o ma-update ng iba ang RJ FM app.</p>
            {profile.creditsEnabled && <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 to-primary/[0.03] p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Available balance</p><p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight">{profile.creditsRemaining ?? 0}</p><p className="mt-1 text-[11px] text-muted-foreground">RJ FM credits</p></div>
              <div className="rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-400/15 to-emerald-400/[0.03] p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Daily allowance</p><p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight">{profile.dailyCredits ?? 0}<span className="ml-1 text-sm font-semibold text-muted-foreground">/ {profile.dailyAllowance ?? 0}</span></p><p className="mt-1 text-[11px] text-muted-foreground">Resets every day</p></div>
            </div>}
            <div className="flex gap-2"><Button type="button" variant={view === 'settings' ? 'secondary' : 'outline'} className="flex-1" onClick={() => openView('settings')}><Settings className="size-4" />Tools</Button>{profile.creditsEnabled && <Button type="button" variant={view === 'usage' ? 'secondary' : 'outline'} className="flex-1" onClick={() => openView('usage')}>Credits usage</Button>}<Button type="button" variant={view === 'permissions' ? 'secondary' : 'outline'} size="icon" aria-label="App permissions" onClick={() => openView('permissions')}><Bell /></Button><Button type="button" variant={view === 'privacy' ? 'secondary' : 'outline'} size="icon" aria-label="Privacy policy" onClick={() => openView('privacy')}><ShieldCheck /></Button></div>
            {view === 'usage' && !profile.creditsEnabled ? <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">Credit features are currently unavailable.</div> : view === 'usage' ? <div className="rounded-2xl border p-4"><p className="font-medium">Weekly activity</p><p className="mt-1 text-xs text-muted-foreground">Credits used this week, Monday to Sunday.</p><UsageChart usage={profile.usage ?? []} /><div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 p-3"><p className="text-xs font-medium">This month</p><div className="mt-2 grid grid-cols-2 gap-2"><div><p className="text-xl font-bold tabular-nums">{profile.monthlyUsage?.credits_used ?? 0}</p><p className="text-[11px] text-muted-foreground">credits used</p></div><div><p className="text-xl font-bold tabular-nums">{profile.monthlyUsage?.requests_count ?? 0}</p><p className="text-[11px] text-muted-foreground">song requests</p></div></div></div><p className="mt-3 text-xs text-muted-foreground">Daily credits reset at midnight Philippine time. Extra credits remain available separately.</p></div> : view === 'settings' ? <div className="flex flex-col gap-3 rounded-2xl border p-4">
              <div><p className="font-semibold">RJ FM Tools</p><p className="mt-1 text-xs text-muted-foreground">Internet speed test and connection ping diagnostics.</p></div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-2"><Gauge className="size-4 text-primary" /><p className="font-medium">Internet Speed Test</p></div>
                <p className="mt-1 text-xs text-muted-foreground">Sukatin ang aktuwal na download speed, upload speed, ping at jitter gamit ang LibreSpeed test network.</p>
                <Button type="button" className="mt-3 w-full" onClick={() => window.open('https://librespeed.org/', '_blank', 'noopener,noreferrer')}><Gauge className="size-4" />Start Internet Speed Test</Button>
                <p className="mt-2 text-[10px] text-muted-foreground">Bubukas ang totoong LibreSpeed test para sa download, upload, ping at jitter.</p>
              </div>
              <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-3">
                <div className="flex items-center gap-2"><Globe className="size-4 text-cyan-500" /><p className="font-medium">Public IP Address</p></div>
                <p className="mt-1 text-xs text-muted-foreground">Kunin ang public IP na nakikita sa internet. Hindi ito ang local Wi-Fi address.</p>
                <div className="mt-3 flex gap-2">
                  <Button type="button" className="flex-1" onClick={checkPublicIp} disabled={ipBusy}>{ipBusy ? <RefreshCw className="size-4 animate-spin" /> : <Globe className="size-4" />}{ipBusy ? 'Checking…' : 'Check IP Address'}</Button>
                  <Button type="button" variant="outline" size="icon" aria-label="Copy IP address" onClick={copyPublicIp} disabled={!publicIp}><Copy className="size-4" /></Button>
                </div>
                {publicIp && <p className="mt-2 break-all rounded-lg bg-background/80 p-2 font-mono text-sm">{publicIp} <span className="text-xs text-emerald-500">{ipCopied ? 'Copied' : ''}</span></p>}
                {ipError && <p className="mt-2 text-xs text-destructive" role="alert">{ipError}</p>}
              </div>
              <div className="rounded-xl border border-border bg-secondary/40 p-3">
                <div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><p className="font-medium">RJ FM Server Ping</p></div>
                <p className="mt-1 text-xs text-muted-foreground">Five round-trip checks from this device to the RJ FM server.</p>
                <Button type="button" variant="outline" className="mt-3 w-full" onClick={runPingTest} disabled={pingBusy}>{pingBusy ? <RefreshCw className="size-4 animate-spin" /> : <Activity className="size-4" />}{pingBusy ? 'Testing ping…' : 'Start ping test'}</Button>
                {pingSamples.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-background p-2"><p className="text-lg font-bold tabular-nums">{Math.min(...pingSamples)} ms</p><p className="text-[10px] text-muted-foreground">Best</p></div>
                  <div className="rounded-lg bg-background p-2"><p className="text-lg font-bold tabular-nums">{(pingSamples.reduce((sum, value) => sum + value, 0) / pingSamples.length).toFixed(1)} ms</p><p className="text-[10px] text-muted-foreground">Average</p></div>
                  <div className="rounded-lg bg-background p-2"><p className="text-lg font-bold tabular-nums">{Math.max(...pingSamples)} ms</p><p className="text-[10px] text-muted-foreground">Worst</p></div>
                </div>}
                {pingBusy && <p className="mt-2 text-center text-xs text-muted-foreground">{pingSamples.length}/5 checks complete</p>}
                {pingError && <p className="mt-2 text-xs text-destructive" role="alert">{pingError}</p>}
              </div>
              <div className="rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-blue-500/5 to-cyan-400/10 p-3">
                <div className="flex items-center gap-2"><Info className="size-4 text-violet-500" /><p className="font-semibold">About RJ FM</p></div>
                <p className="mt-2 text-sm font-medium">RJ FM — Live Radio</p>
                <p className="mt-1 text-xs text-muted-foreground">Developer: Carl Smith</p>
                <p className="mt-1 text-xs text-muted-foreground">Official RJ FM radio player and listening tools.</p>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => openView('permissions')}><ShieldCheck className="size-4" />App permissions</Button>
            </div> : view === 'permissions' ? <div className="flex flex-col gap-3 rounded-2xl border p-4">
                <div><p className="font-medium">App permissions</p><p className="mt-1 text-xs text-muted-foreground">Piliin kung aling access ang ibibigay sa RJ FM. Hihingi lang ng pahintulot kapag pinindot mo ang button.</p></div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 p-3"><div className="flex items-center gap-2"><Bell className="size-4 text-primary" /><div><p className="text-sm font-medium">Notifications</p><p className="text-xs text-muted-foreground">System notification habang tumutugtog + RJ FM alerts</p></div></div><Button type="button" size="sm" onClick={enableNotifications} disabled={permissionBusy}>Allow</Button></div>
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
