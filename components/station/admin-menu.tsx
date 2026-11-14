'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ExternalLink, Info, Lock, LogOut, Menu, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { AdminPanel } from './admin-panel'

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json())

const FACEBOOK_PAGE = 'https://www.facebook.com/profile.php?id=61594892455381'
const FACEBOOK_ADMIN = 'https://www.facebook.com/profile.php?id=61595422155719'

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  )
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Info; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </h3>
  )
}

export function AdminMenu() {
  const { data, mutate } = useSWR<{ admin: boolean }>('/api/admin/session', fetcher)
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError(res.status === 401 ? 'Incorrect password. Please try again.' : 'Could not sign in. Please try again.')
        return
      }
      setPassword('')
      await mutate({ admin: true })
    } catch {
      setError('Could not reach the admin sign-in service. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/admin/session', { method: 'DELETE', cache: 'no-store' })
      await mutate({ admin: false })
    } catch {
      setError('Could not log out. Please check your connection and try again.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
        <Menu aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>
            RJ <span className="text-primary">FM</span>
          </SheetTitle>
          <SheetDescription>RJ FM LIVESTREAM ONLY</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          <section className="flex flex-col gap-3">
            <SectionTitle icon={Info}>Info</SectionTitle>
            <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 text-sm">
              <p className="font-medium">RJ FM</p>
              <p className="text-muted-foreground">Livestream only · 24/7 automated music</p>
              <p className="text-muted-foreground">Schedule is managed in the Admin Panel.</p>
              <p className="mt-2 text-muted-foreground">Tune in, relax, and enjoy the music.</p>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle icon={Users}>Social Media</SectionTitle>
            <Button
              render={<a href={FACEBOOK_PAGE} target="_blank" rel="noopener noreferrer" />}
              className="h-11 bg-[#1877F2] text-white hover:bg-[#1877F2]/90"
            >
              <FacebookIcon className="size-4" />
              Follow our Facebook Page
            </Button>
            <Button
              variant="outline"
              render={<a href={FACEBOOK_ADMIN} target="_blank" rel="noopener noreferrer" />}
              className="h-11"
            >
              <FacebookIcon className="size-4 text-[#1877F2]" />
              Admin
              <ExternalLink className="ml-auto size-3.5 text-muted-foreground" aria-hidden="true" />
            </Button>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle icon={Lock}>Admin</SectionTitle>
            {data?.admin ? (
              <>
                {open && <AdminPanel />}
                <Button variant="outline" onClick={logout}>
                  <LogOut aria-hidden="true" />
                  Log out
                </Button>
              </>
            ) : (
              <form onSubmit={login} className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
              <Label htmlFor="admin-password">Admin password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={loading || !password}>
                  <Lock aria-hidden="true" />
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
