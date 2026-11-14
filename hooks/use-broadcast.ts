'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NowResponse, Track } from '@/lib/types'

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
const PRELOAD_AHEAD_MS = 180_000
const DRIFT_TOLERANCE_S = 15

interface Slot {
  el: HTMLAudioElement
  uid: string | null
  src: string | null
  synced: boolean
  lastPlayAttemptAt: number
  activeWaitSince: number | null
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const curve = (n: number) => Math.sin((clamp01(n) * Math.PI) / 2)

function crossfadeGain(progress: number, curveName: string, fadeIn: boolean) {
  const p = clamp01(progress)
  if (curveName === 'full-cut') return fadeIn ? (p >= 1 ? 1 : 0) : (p >= 1 ? 0 : 1)
  if (curveName === 'fast-cut') return fadeIn ? (p >= 0.2 ? 1 : p * 5) : (p >= 0.8 ? 0 : 1)
  if (curveName === 'slow-cut') return fadeIn ? p * p : 1 - p * p
  if (curveName === 'slow-fade') return fadeIn ? p * p * p : 1 - p * p * p
  if (curveName === 'fast-fade') return fadeIn ? Math.sqrt(p) : Math.sqrt(1 - p)
  if (curveName === 'dipped') return fadeIn ? (p < 0.5 ? p * 1.4 : 0.7 + (p - 0.5) * 0.6) : (p < 0.5 ? 1 - p * 0.6 : 0.7 - (p - 0.5) * 1.4)
  if (curveName === 'scratch-cut') return fadeIn ? (p > 0.12 ? 1 : 0) : (p > 0.88 ? 0 : 1)
  if (curveName === 'smooth') { const shaped = p * p * (3 - 2 * p); return fadeIn ? shaped : 1 - shaped }
  if (curveName === 'constant-power') return fadeIn ? curve(p) : Math.cos((p * Math.PI) / 2)
  return fadeIn ? p : 1 - p
}

function trackGain(track: Track, now: number, enabled: boolean, curveName: string) {
  if (!enabled) return 1
  const elapsed = (now - track.startAt) / 1000
  const remaining = track.duration - elapsed
  const fadeIn = track.fadeIn > 0 ? crossfadeGain(elapsed / track.fadeIn, curveName, true) : 1
  const fadeOut = track.fadeOut > 0 ? crossfadeGain(1 - remaining / track.fadeOut, curveName, false) : 1
  return Math.min(fadeIn, fadeOut)
}

function playErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError') return 'Your browser blocked audio playback. Press Play again to allow the station audio.'
  if (name === 'NotSupportedError') return 'This browser could not decode the station audio. Try another browser or device.'
  return 'The station audio could not start. Press Play again to reconnect.'
}

function mediaErrorMessage(code: number) {
  if (code === 2) return 'The station audio connection failed. Press Play again to reconnect.'
  if (code === 3) return 'The station audio could not be decoded. Press Play again to retry.'
  if (code === 4) return 'The station audio source is unavailable. Press Play again to refresh it.'
  return 'The station audio stopped unexpectedly. Press Play again to reconnect.'
}

export function useBroadcast(data: NowResponse | undefined, playing: boolean, volume: number) {
  const slots = useRef<Slot[]>([])
  const offset = useRef(0)
  const [state, setState] = useState({ onAir: false, buffering: false, offAir: false })
  const [playbackIssue, setPlaybackIssue] = useState<string | null>(null)
  const noTrackSince = useRef<number | null>(null)

  useEffect(() => {
    if (!data) return
    offset.current = data.serverTime - Date.now()
  }, [data])

  const unlock = useCallback(() => {
    setPlaybackIssue(null)
    if (slots.current.length > 0) return
    slots.current = Array.from({ length: 5 }, () => {
      const el = new Audio()
      el.controls = false
      el.preload = 'auto'
      el.src = SILENT_WAV
      el.play().catch(() => undefined)
      return { el, uid: null, src: null, synced: false, lastPlayAttemptAt: 0, activeWaitSince: null }
    })
  }, [])

  useEffect(() => {
    const tick = () => {
      const now = Date.now() + offset.current
      const tracks = data?.tracks ?? []
      const signOnReached = data?.nextOnAir != null && now >= data.nextOnAir
      const scheduleOffAir = Boolean((data?.offAir && !signOnReached) || (data?.signOffAt != null && now >= data.signOffAt && !signOnReached))
      const active = scheduleOffAir ? [] : tracks.filter((t) => now >= t.startAt && now < t.startAt + t.duration * 1000)
      const voiceActive = active.some((t) => t.kind === 'dj-mic')
      const config = data?.audioConfig
      const nightVolumeGain = data?.nightVolumeActive ? (config?.nightVolumePercent ?? 72) / 100 : 1
      const masterGain = (config?.masterVolume ?? 100) / 100
      const replayGain = config?.replayGainEnabled ? Math.pow(10, ((config.replayGainTargetLufs ?? -14) + 14) / 20) : 1
      const upcoming = scheduleOffAir ? [] : tracks.filter((t) => t.startAt > now && t.startAt - now < PRELOAD_AHEAD_MS)
      const wanted = [...active, ...upcoming].slice(0, slots.current.length)
      const wantedIds = new Set(wanted.map((t) => t.uid))

      for (const slot of slots.current) {
        if (slot.uid && !wantedIds.has(slot.uid)) {
          slot.el.pause()
          slot.uid = null
          slot.src = null
          slot.synced = false
        }
      }

      let buffering = false
      for (const track of wanted) {
        let slot = slots.current.find((s) => s.uid === track.uid)
        if (!slot) {
          slot = slots.current.find((s) => s.uid === null)
          if (!slot) continue
          slot.uid = track.uid
          slot.src = track.src
          slot.synced = false
          slot.lastPlayAttemptAt = 0
          slot.activeWaitSince = null
          slot.el.src = track.src
          slot.el.load()
        } else if (slot.src !== track.src) {
          slot.el.pause()
          slot.src = track.src
          slot.synced = false
          slot.lastPlayAttemptAt = 0
          slot.activeWaitSince = null
          slot.el.src = track.src
          slot.el.load()
        }
        const isActive = active.includes(track)
        const el = slot.el

        if (!playing || !isActive) {
          slot.activeWaitSince = null
          if (!el.paused) el.pause()
          continue
        }

        const expected = (now - track.startAt) / 1000
        if (el.error && now - slot.lastPlayAttemptAt >= 2_000) {
          // Expiring third-party download URLs can fail after the queue was built.
          // Reload the same element so the next poll/source refresh can recover it.
          slot.lastPlayAttemptAt = now
          slot.synced = false
          setPlaybackIssue(mediaErrorMessage(el.error.code))
          el.load()
        }
        if (el.readyState >= 1) {
          // Live radio relays do not have a seekable timeline like an MP3.
          // Always play them from the current live edge instead of seeking to
          // the elapsed station schedule time (which can be several hours).
          if (track.kind === 'brigada-news') {
            slot.synced = true
          } else {
            const drift = Math.abs(el.currentTime - expected)
            if (!slot.synced || (drift > DRIFT_TOLERANCE_S && el.readyState >= 3 && !el.seeking)) {
              if (!el.duration || expected < el.duration - 1) el.currentTime = Math.max(0, expected)
              slot.synced = true
            }
          }
        }
        // A live radio relay can begin from HAVE_METADATA (1) while the browser
        // continues filling its rolling buffer. Waiting for HAVE_CURRENT_DATA
        // makes valid live streams appear stuck in loading on mobile browsers.
        const minimumReadyState = track.kind === 'brigada-news' ? 1 : 2
        if (el.readyState < minimumReadyState && !el.ended) {
          buffering = true
          slot.activeWaitSince ??= now
          if (now - slot.activeWaitSince >= 25_000) setPlaybackIssue('The stream is taking too long to load. Press Play again to reconnect.')
        } else {
          slot.activeWaitSince = null
        }
        const duckGain = voiceActive && track.kind === 'music' ? 0.18 : 1
        const outputGain = clamp01(trackGain(track, now, config?.crossfaderEnabled ?? true, config?.crossfaderCurve ?? 'constant-power') * volume * masterGain * nightVolumeGain * replayGain * duckGain)
        // Keep playback on the native element: third-party MP3 hosts may not send
        // CORS headers, and routing those sources through Web Audio can mute them.
        el.volume = outputGain
        if (el.paused && !el.ended && now - slot.lastPlayAttemptAt >= 1_000) {
          slot.lastPlayAttemptAt = now
          el.play().then(() => setPlaybackIssue(null)).catch((error: unknown) => {
            if (!(error instanceof DOMException) || error.name !== 'AbortError') setPlaybackIssue(playErrorMessage(error))
          })
        }
      }

      const onAir = active.length > 0
      if (data && playing && !onAir && !scheduleOffAir) {
        noTrackSince.current ??= now
        if (now - noTrackSince.current >= 25_000) setPlaybackIssue('No active audio stream is available right now. Press Play again to reconnect.')
      } else {
        noTrackSince.current = null
      }
      setState((prev) => {
        const next = { onAir, buffering: playing && (buffering || (!onAir && !scheduleOffAir)), offAir: scheduleOffAir }
        return prev.onAir === next.onAir && prev.buffering === next.buffering && prev.offAir === next.offAir ? prev : next
      })
    }

    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [data, playing, volume])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !playing) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'MOR 93.5 Naga',
      artist: 'MOR 93.5 NAGA LIVESTREAM ONLY',
      album: 'MOR 93.5 Naga Livestream',
      artwork: [{ src: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    })
  }, [playing])

  useEffect(
    () => () => {
      for (const slot of slots.current) {
        slot.el.pause()
        slot.el.removeAttribute('src')
      }
      slots.current = []
    },
    [],
  )

  return { ...state, playbackIssue, unlock }
}
