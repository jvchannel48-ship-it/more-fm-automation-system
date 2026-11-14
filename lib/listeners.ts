import 'server-only'
import { getStoredListenerCount, registerListener as registerStoredListener } from './storage'
import type { ListenerGeoLocation } from './types'

export async function updateListener(id: string, active: boolean, listenerLimit: number, location?: Pick<ListenerGeoLocation, 'city' | 'region' | 'countryCode'>) {
  return registerStoredListener(id, active, listenerLimit, location)
}

export async function getListenerCount() {
  return getStoredListenerCount()
}
