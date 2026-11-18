'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Bell, FileText, Image as ImageIcon, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { StationNotification } from '@/lib/notifications'

const READ_KEY = 'mor-935-read-notifications'
const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((response) => response.json() as Promise<{ notifications: StationNotification[] }>)

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  })
}

export function NotificationCenter() {
  const { data } = useSWR('/api/notifications', fetcher, { refreshInterval: 15000, revalidateOnFocus: true })
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<string[]>([])
  const notifications = data?.notifications ?? []

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(READ_KEY) ?? '[]')
      if (Array.isArray(saved)) setReadIds(saved.filter((item): item is string => typeof item === 'string'))
    } catch {
      setReadIds([])
    }
  }, [])

  const unreadCount = useMemo(() => notifications.filter((item) => !readIds.includes(item.id)).length, [notifications, readIds])

  const markAllRead = () => {
    const next = Array.from(new Set([...readIds, ...notifications.map((item) => item.id)])).slice(-100)
    setReadIds(next)
    try {
      window.localStorage.setItem(READ_KEY, JSON.stringify(next))
    } catch {
      // The panel still opens even when local storage is unavailable.
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => {
      setOpen(next)
      if (next) markAllRead()
    }}>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Open notifications'} className="relative" />}>
        <Bell aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white shadow-[0_0_8px_rgba(239,68,68,0.7)]" aria-label={`${unreadCount} unread`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Bell className="size-4 text-primary" />Notifications</SheetTitle>
          <SheetDescription>Mga bagong announcement mula sa MOR 93.5 Naga.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-6">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground">
              <Inbox className="size-7" aria-hidden="true" />
              <p className="text-sm">Walang notification sa ngayon.</p>
            </div>
          ) : notifications.map((item) => (
            <article key={item.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(item.createdAt)}</p>
                </div>
                <span className="rounded-full bg-primary/10 p-1.5 text-primary" aria-hidden="true"><Bell className="size-3.5" /></span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{item.message}</p>
              {item.attachment?.type.startsWith('image/') && (
                <img src={item.attachment.dataUrl} alt={item.attachment.name} className="mt-3 max-h-64 w-full rounded-lg border border-border object-contain" />
              )}
              {item.attachment && !item.attachment.type.startsWith('image/') && (
                <a href={item.attachment.dataUrl} download={item.attachment.name} className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-primary hover:bg-secondary/80">
                  {item.attachment.type.startsWith('text/') ? <FileText className="size-4" /> : <ImageIcon className="size-4" />}
                  {item.attachment.name}
                </a>
              )}
            </article>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
