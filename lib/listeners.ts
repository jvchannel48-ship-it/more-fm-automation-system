import 'server-only'
import { getStoredListenerCount, registerListener as registerStoredListener } from './storage'

export async function updateListener(id: string, active: boolean, listenerLimit: number) {
  return registerStoredListener(id, active, listenerLimit)
}

export async function getListenerCount() {
  return getStoredListenerCount()
}
