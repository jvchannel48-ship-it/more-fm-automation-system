import 'server-only'
import { LISTENERS_PATH, readJson, writeJson } from './storage'

const ACTIVE_WINDOW_MS = 60_000
type ListenerMap = Record<string, number>

export async function updateListener(id: string, active: boolean) {
  const now = Date.now()
  const listeners = await readJson<ListenerMap>(LISTENERS_PATH, {})
  for (const [key, seenAt] of Object.entries(listeners)) {
    if (seenAt < now - ACTIVE_WINDOW_MS) delete listeners[key]
  }
  if (active) listeners[id] = now
  else delete listeners[id]
  await writeJson(LISTENERS_PATH, listeners)
  return Object.keys(listeners).length
}

export async function getListenerCount() {
  const now = Date.now()
  const listeners = await readJson<ListenerMap>(LISTENERS_PATH, {})
  return Object.values(listeners).filter((seenAt) => seenAt >= now - ACTIVE_WINDOW_MS).length
}
