import 'server-only'

import { getSettings, readJson, writeJson } from './storage'

export const NOTIFICATIONS_PATH = 'station/notifications.json'
export const MAX_NOTIFICATIONS = 50
export const MAX_ATTACHMENT_BYTES = 1_500_000
export const MAX_NOTIFICATION_ATTACHMENTS = 3
export const AUTO_NOTIFICATION_PATH = 'station/notification-automation.json'
export const RJ_AUTO_INTERVAL_MS = 8 * 60 * 1000

const DEFAULT_RJ_MESSAGES = [
  'Hello, listeners! Keep the music playing and enjoy RJ FM live radio.',
  'Hello music lovers! Stay tuned—your next favorite song is on the way.',
  'Hello! Keep the music on and let RJ FM live radio brighten your day.',
  'Hello, RJ FM family! Thank you for listening with us today.',
]

let autoNotificationPromise: Promise<unknown> | null = null

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
  const legacySafeMessage = item.message.replaceAll('MOR 93.5', 'RJ FM').replaceAll('RJ FM 93.5', 'RJ FM')
  const legacySafeSender = typeof item.senderName === 'string' ? item.senderName.slice(0, 80) : 'RJ FM OFFICIAL'
  return {
    id: item.id,
    title: item.title.slice(0, 120),
    message: legacySafeMessage.slice(0, 3000),
    createdAt: item.createdAt,
    senderName: legacySafeSender === 'MOR 93.5' || legacySafeSender === 'RJ FM 93.5' ? 'RJ FM OFFICIAL' : legacySafeSender,
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

/**
 * The public notification poll is the app-owned heartbeat for active listeners.
 * It creates at most one official message per eight-minute window, even when
 * several phones poll at the same time in this server process.
 */
export async function maybeCreateRjOfficialNotification() {
  if (autoNotificationPromise) return autoNotificationPromise
  autoNotificationPromise = (async () => {
    const settings = await getSettings()
    if (!settings.rjOfficialAutoEnabled) return null

    const state = await readJson<{ lastSentAt?: number; lastMessageIndex?: number }>(AUTO_NOTIFICATION_PATH, {})
    const lastSentAt = typeof state.lastSentAt === 'number' ? state.lastSentAt : 0
    if (Date.now() - lastSentAt < RJ_AUTO_INTERVAL_MS) return null

    const customMessage = settings.rjOfficialAutoMessage.trim()
    const messages = customMessage ? [customMessage] : DEFAULT_RJ_MESSAGES
    const previousIndex = typeof state.lastMessageIndex === 'number' ? state.lastMessageIndex : -1
    const nextIndex = messages.length > 1 ? (previousIndex + 1) % messages.length : 0
    const result = await addNotification({
      title: 'Hello from RJ FM OFFICIAL',
      message: messages[nextIndex],
      senderName: 'RJ FM OFFICIAL',
      senderVerified: true,
    })
    await writeJson(AUTO_NOTIFICATION_PATH, { lastSentAt: Date.now(), lastMessageIndex: nextIndex })
    return result
  })().finally(() => {
    autoNotificationPromise = null
  })
  return autoNotificationPromise
}
