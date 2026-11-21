'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | undefined
    let cancelled = false

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((result) => {
        if (!cancelled) registration = result
      })
      .catch((error) => {
        console.warn('RJ FM offline support could not be registered:', error)
      })

    return () => {
      cancelled = true
      void registration
    }
  }, [])

  return null
}
