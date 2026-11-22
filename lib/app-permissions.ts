'use client'

import { Capacitor, registerPlugin } from '@capacitor/core'

interface BatteryOptimizationPlugin {
  isIgnoringOptimizations(): Promise<{ exempt: boolean }>
  requestExemption(): Promise<{ opened: boolean }>
}

const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>('BatteryOptimization')

export const ONESIGNAL_APP_ID = 'a15a432f-006c-4687-ba48-1445d36a77fa'

let initialized = false

export async function initializePushNotifications() {
  if (!Capacitor.isNativePlatform()) return false
  const OneSignal = (await import('@onesignal/capacitor-plugin')).default
  if (!initialized) {
    await OneSignal.initialize(ONESIGNAL_APP_ID)
    initialized = true
  }
  return true
}

export async function requestPushPermission() {
  if (!await initializePushNotifications()) {
    throw new Error('Ang push notifications ay available sa installed RJ FM Android app.')
  }
  const OneSignal = (await import('@onesignal/capacitor-plugin')).default
  const granted = await OneSignal.Notifications.requestPermission(true)
  return Boolean(granted)
}

export async function getPushPermissionStatus() {
  if (!Capacitor.isNativePlatform()) return null
  await initializePushNotifications()
  const OneSignal = (await import('@onesignal/capacitor-plugin')).default
  return OneSignal.Notifications.hasPermission()
}

export async function requestMicrophonePermission() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Hindi available ang microphone permission sa browser/device na ito.')
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  stream.getTracks().forEach((track) => track.stop())
  return true
}

export async function getBatteryOptimizationStatus() {
  if (!Capacitor.isNativePlatform()) return null
  return (await BatteryOptimization.isIgnoringOptimizations()).exempt
}

export async function requestBatteryOptimizationExemption() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Available lang ito sa installed RJ FM Android app.')
  }
  return BatteryOptimization.requestExemption()
}


interface BackgroundAudioPlugin {
  start(options: { station: string }): Promise<void>
  stop(): Promise<void>
}

const BackgroundAudio = registerPlugin<BackgroundAudioPlugin>('BackgroundAudio')

export async function syncBackgroundAudioNotification(playing: boolean, station: string) {
  if (!Capacitor.isNativePlatform()) return
  if (playing) await BackgroundAudio.start({ station })
  else await BackgroundAudio.stop()
}
