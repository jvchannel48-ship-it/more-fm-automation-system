'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { ArrowLeft, BadgeCheck, Bell, Image as ImageIcon, Inbox, Megaphone, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { StationNotification } from '@/lib/notifications'
import { STATIONS, type StationId } from '@/lib/stations'
import { getStoredStation } from './station-selector'
import {
  clearAllNotificationState,
  filterVisibleNotifications,
  MAX_SAVED_NOTIFICATION_IDS,
  mergeNotificationIds,
} from '@/lib/notification-state'

const READ_KEY = 'rj-fm-read-notifications'
const DISMISSED_KEY = 'rj-fm-dismissed-notifications'
const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((response) => response.json() as Promise<{ notifications: StationNotification[] }>)

function readStoredIds(key: string) {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === 'string').slice(-MAX_SAVED_NOTIFICATION_IDS)
      : []
  } catch {
    return []
  }
}

function saveStoredIds(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // Keep the current browser session usable if local storage is unavailable.
  }
}

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
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const [selectedNotification, setSelectedNotification] = useState<StationNotification | null>(null)
  const [stationId, setStationId] = useState<StationId>('main')
  const notifications = data?.notifications ?? []
  const station = STATIONS[stationId]

  useEffect(() => {
    setReadIds(readStoredIds(READ_KEY))
    setDismissedIds(readStoredIds(DISMISSED_KEY))
    setStationId(getStoredStation())
  }, [])

  const visibleNotifications = useMemo(
    () => filterVisibleNotifications(notifications, dismissedIds),
    [notifications, dismissedIds],
  )
  const unreadCount = useMemo(
    () => visibleNotifications.filter((item) => !readIds.includes(item.id)).length,
    [visibleNotifications, readIds],
  )

  const markAllRead = () => {
    const next = mergeNotificationIds(readIds, visibleNotifications.map((item) => item.id))
    setReadIds(next)
    saveStoredIds(READ_KEY, next)
  }

  const clearAll = () => {
    if (visibleNotifications.length === 0) return

    const next = clearAllNotificationState(visibleNotifications, dismissedIds, readIds)
    setDismissedIds(next.dismissedIds)
    setReadIds(next.readIds)
    saveStoredIds(DISMISSED_KEY, next.dismissedIds)
    saveStoredIds(READ_KEY, next.readIds)
  }

  return (
    <Sheet open={open} onOpenChange={(next) => {
      setOpen(next)
      if (!next) setSelectedNotification(null)
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
      <SheetContent side="right" className="w-full overflow-y-auto border-l border-primary/20 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-sm">
        <SheetHeader className="border-b border-border/70 bg-gradient-to-br from-primary/15 via-card to-background px-5 pb-5 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner shadow-primary/20">
              <Megaphone className="size-5" aria-hidden="true" />
            </div>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              {unreadCount ? `${unreadCount} new` : station.shortName}
            </span>
          </div>
          <SheetTitle className="mt-4 flex items-center gap-2 text-xl">
            {selectedNotification ? (
              <Button type="button" variant="ghost" size="sm" className="-ml-2 h-8 px-2" onClick={() => setSelectedNotification(null)}>
                <ArrowLeft className="size-4" /> Back
              </Button>
            ) : (
              <><Bell className="size-4 text-primary" />Notifications</>
            )}
          </SheetTitle>
          <SheetDescription>{station.notificationTagline} · Mga verified announcement at updates mula sa RJ FM OFFICIAL.</SheetDescription>
        </SheetHeader>
        {!selectedNotification && visibleNotifications.length > 0 && (
          <div className="flex items-center justify-between px-5 pt-4">
            <p className="text-xs text-muted-foreground">{visibleNotifications.length} update{visibleNotifications.length === 1 ? '' : 's'}</p>
            <Button type="button" variant="ghost" size="sm" aria-label="Clear all notifications" onClick={clearAll} className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
              <Trash2 aria-hidden="true" />
              Clear all
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-3 px-5 pb-6 pt-4">
          {selectedNotification ? (
            <article className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{selectedNotification.title}</h3>
                  <p className="mt-2 flex items-center gap-1 text-xs font-medium text-foreground/80">
                    {selectedNotification.senderName} <BadgeCheck className="size-3.5 fill-sky-500 text-white" aria-label="Verified account" />
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(selectedNotification.createdAt)}</p>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{selectedNotification.message}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(selectedNotification.attachments ?? (selectedNotification.attachment ? [selectedNotification.attachment] : [])).map((attachment) => (
                  <img key={attachment.name} src={attachment.dataUrl} alt={attachment.name} className="max-h-80 w-full rounded-lg border border-border object-contain" />
                ))}
              </div>
            </article>
          ) : (
          <>
          {visibleNotifications.length === 0 ? (
            <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-dashed border-primary/25 bg-gradient-to-b from-primary/5 to-card px-4 py-12 text-center text-muted-foreground">
              <Sparkles className="absolute right-4 top-4 size-4 text-primary/40" aria-hidden="true" />
              <Inbox className="size-8 text-primary/70" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground/80">
                {notifications.length === 0
                  ? 'Walang notification sa ngayon.'
                  : 'Na-clear mo na ang lahat ng notification sa browser na ito.'}
              </p>
            </div>
          ) : visibleNotifications.map((item) => (
            <article key={item.id} role="button" tabIndex={0} onClick={() => setSelectedNotification(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedNotification(item) }} className="group cursor-pointer rounded-2xl border border-border/80 border-l-2 border-l-primary/70 bg-gradient-to-br from-card via-card to-primary/[0.04] p-4 shadow-sm transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">{item.senderName} {item.senderVerified && <BadgeCheck className="size-3 fill-sky-500 text-white" aria-label="Verified account" />} · {formatDate(item.createdAt)}</p>
                </div>
                <span className="rounded-full bg-primary/10 p-1.5 text-primary" aria-hidden="true"><Bell className="size-3.5" /></span>
              </div>
              <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{item.message}</p>
              {(item.attachments?.length ?? (item.attachment ? 1 : 0)) > 0 && <p className="mt-2 flex items-center gap-1 text-xs text-primary"><ImageIcon className="size-3.5" />{item.attachments?.length ?? 1} image{(item.attachments?.length ?? 1) === 1 ? '' : 's'}</p>}
            </article>
          ))}
          </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
