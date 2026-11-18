export const MAX_SAVED_NOTIFICATION_IDS = 100

export interface NotificationWithId {
  id: string
}

export function mergeNotificationIds(existing: readonly string[], added: readonly string[]) {
  return Array.from(new Set([...existing, ...added])).slice(-MAX_SAVED_NOTIFICATION_IDS)
}

export function filterVisibleNotifications<T extends NotificationWithId>(
  notifications: readonly T[],
  dismissedIds: readonly string[],
): T[] {
  const dismissed = new Set(dismissedIds)
  return notifications.filter((notification) => !dismissed.has(notification.id))
}

export function clearAllNotificationState<T extends NotificationWithId>(
  visibleNotifications: readonly T[],
  dismissedIds: readonly string[],
  readIds: readonly string[],
) {
  const currentIds = visibleNotifications.map((notification) => notification.id)
  return {
    dismissedIds: mergeNotificationIds(dismissedIds, currentIds),
    readIds: mergeNotificationIds(readIds, currentIds),
  }
}
