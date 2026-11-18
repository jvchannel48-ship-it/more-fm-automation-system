import 'server-only'

import { readJson, writeJson } from './storage'

export const NOTIFICATIONS_PATH = 'station/notifications.json'
export const MAX_NOTIFICATIONS = 50
export const MAX_ATTACHMENT_BYTES = 1_500_000
export const MAX_NOTIFICATION_ATTACHMENTS = 3

export interface NotificationAttachment {
  name: string
  type: string
  dataUrl: string
}

export interface StationNotification {
  id: string
  title: string
  message: string
  createdAt: number
  senderName: string
  senderVerified: boolean
  attachments?: NotificationAttachment[]
  attachment?: NotificationAttachment
}

function normalizeNotification(value: unknown): StationNotification | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<StationNotification>
  if (typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.message !== 'string' || typeof item.createdAt !== 'number') {
    return null
  }
  const attachment = item.attachment
  return {
    id: item.id,
    title: item.title.slice(0, 120),
    message: item.message.slice(0, 3000),
    createdAt: item.createdAt,
    senderName: typeof item.senderName === 'string' ? item.senderName.slice(0, 80) : 'RJ FM 93.5',
    senderVerified: item.senderVerified !== false,
    ...(Array.isArray(item.attachments)
      ? { attachments: item.attachments
        .filter((attachment) => attachment && typeof attachment.name === 'string' && typeof attachment.type === 'string' && typeof attachment.dataUrl === 'string')
        .slice(0, MAX_NOTIFICATION_ATTACHMENTS)
        .map((attachment) => ({ name: attachment.name.slice(0, 160), type: attachment.type.slice(0, 100), dataUrl: attachment.dataUrl })) }
      : {}),
    ...(attachment && typeof attachment.name === 'string' && typeof attachment.type === 'string' && typeof attachment.dataUrl === 'string'
      ? { attachment: { name: attachment.name.slice(0, 160), type: attachment.type.slice(0, 100), dataUrl: attachment.dataUrl } }
      : {}),
  }
}

export async function getNotifications() {
  const saved = await readJson<unknown>(NOTIFICATIONS_PATH, [])
  if (!Array.isArray(saved)) return []
  return saved.map(normalizeNotification).filter((item): item is StationNotification => Boolean(item)).slice(0, MAX_NOTIFICATIONS)
}

export async function addNotification(notification: Omit<StationNotification, 'id' | 'createdAt'>) {
  const current = await getNotifications()
  const created: StationNotification = {
    ...notification,
    id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
  }
  const persistenceConfigured = await writeJson(NOTIFICATIONS_PATH, [created, ...current].slice(0, MAX_NOTIFICATIONS))
  return { notification: created, persistenceConfigured }
}
