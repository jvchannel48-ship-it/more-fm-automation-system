'use client'

import { useEffect, useState } from 'react'

export function PwaRegister() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const updateNetwork = () => setOffline(!navigator.onLine)
    updateNetwork()
    window.addEventListener('online', updateNetwork)
    window.addEventListener('offline', updateNetwork)

    if ('storage' in navigator && 'persist' in navigator.storage) {
      void navigator.storage.persist().catch(() => false)
    }

    if (!('serviceWorker' in navigator)) {
      return () => {
        window.removeEventListener('online', updateNetwork)
        window.removeEventListener('offline', updateNetwork)
      }
    }

    let cancelled = false
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (cancelled) return
        // Activate the newest offline cache when an update is available.
        void registration.update().catch(() => undefined)
      })
      .catch((error) => console.warn('RJ FM offline support could not be registered:', error))

    return () => {
      cancelled = true
      window.removeEventListener('online', updateNetwork)
      window.removeEventListener('offline', updateNetwork)
    }
  }, [])

  if (!offline) return null

  return (
    <div role="status" className="fixed inset-x-3 top-3 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-amber-300/40 bg-slate-950/95 px-4 py-3 text-left text-xs text-white shadow-2xl backdrop-blur-xl">
      <span className="size-2 shrink-0 rounded-full bg-amber-400" />
      <span><strong className="block text-amber-200">RJ FM Offline Mode</strong>Live radio needs internet. Small tracks already played online may be saved for offline listening.</span>
    </div>
  )
}
