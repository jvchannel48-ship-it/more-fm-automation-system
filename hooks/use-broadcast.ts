'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NowResponse, Track } from '@/lib/types'

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
// Keep only the current and immediately upcoming songs active. Two slots are
// required for a real overlap: one fades down while the next fades up.
const PRELOAD_AHEAD_MS = 60_000
const DRIFT_TOLERANCE_S = 15

interface Slot {
  el: HTMLAudioElement
  bassFilter: BiquadFilterNode | null
  uid: string | null
  src: string | null
  synced: boolean
  lastPlayAttemptAt: number
  activeWaitSince: number | null
  reloadAttempts: number
  ended: boolean
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const curve = (n: number) => Math.sin((clamp01(n) * Math.PI) / 2)

export function crossfadeGain(progress: number, curveName: string, fadeIn: boolean) {
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
  if (name === 'NotAllowedError') return 'Your browser blocked audio playback. Click Play once to allow the station audio.'
  if (name === 'NotSupportedError') return 'This browser could not decode the station audio. Try another browser or device.'
  return 'Audio playback could not start. Click Play to try again.'
}

export function useBroadcast(data: NowResponse | undefined, playing: boolean, volume: number, onStreamError?: (uid: string) => void) {
  const slots = useRef<Slot[]>([])
  // Render can briefly return an empty/stale queue while swapping instances.
  // Keep the last known on-air track available until its scheduled end so the
  // browser audio element is not stopped during that deploy window.
  const knownTracks = useRef(new Map<string, Track>())
  const audioContext = useRef<AudioContext | null>(null)
  const failedUids = useRef(new Set<string>())
  const forcedNextUid = useRef<string | null>(null)
  const offset = useRef(0)
  const [state, setState] = useState({ onAir: false, buffering: false, offAir: false, currentUid: null as string | null })
  const [playbackIssue, setPlaybackIssue] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    offset.current = data.serverTime - Date.now()
    for (const track of data.tracks) knownTracks.current.set(track.uid, track)
    const currentIds = new Set(data.tracks.map((track) => track.uid))
    failedUids.current.forEach((uid) => {
      if (!currentIds.has(uid)) failedUids.current.delete(uid)
    })
  }, [data])

  const ensureSlots = useCallback(() => {
    if (slots.current.length > 0) return
    slots.current = Array.from({ length: 2 }, () => {
      const el = new Audio()
      el.controls = false
      el.preload = 'auto'
      el.volume = 0
      el.onended = () => {
        const slot = slots.current.find((candidate) => candidate.el === el)
        if (slot) slot.ended = true
      }
      return { el, bassFilter: null, uid: null, src: null, synced: false, lastPlayAttemptAt: 0, activeWaitSince: null, reloadAttempts: 0, ended: false }
    })
  }, [])

  const unlock = useCallback(() => {
    setPlaybackIssue(null)
    ensureSlots()
    try {
      const context = audioContext.current ?? new AudioContext()
      audioContext.current = context
      for (const slot of slots.current) {
        if (slot.bassFilter) continue
        try {
          const source = context.createMediaElementSource(slot.el)
          const bassFilter = context.createBiquadFilter()
          bassFilter.type = 'lowshelf'
          bassFilter.frequency.value = 180
          bassFilter.gain.value = data?.audioConfig.bassGainDb ?? 12
          source.connect(bassFilter).connect(context.destination)
          slot.bassFilter = bassFilter
        } catch {
          slot.bassFilter = null
        }
      }
      if (context.state === 'suspended') void context.resume().catch(() => undefined)
    } catch {
      audioContext.current = null
    }
    const now = Date.now() + offset.current
    for (const slot of slots.current) {
      const track = data?.tracks.find((candidate) => candidate.uid === slot.uid)
      if (track && now >= track.startAt && now < track.startAt + track.duration * 1000 && slot.el.readyState >= 1) {
        const expected = Math.max(0, (now - track.startAt) / 1000)
        if (!slot.el.duration || expected < slot.el.duration - 1) {
          slot.el.currentTime = expected
          slot.synced = true
        }
      }
      slot.el.volume = 0
      if (!slot.src) slot.el.src = SILENT_WAV
      void slot.el.play().catch(() => undefined)
    }
  }, [data, ensureSlots])

  useEffect(() => {
    ensureSlots()
  }, [ensureSlots])

  useEffect(() => {
    const tick = () => {
      const now = Date.now() + offset.current
      const serverTracks = data?.tracks ?? []
      const tracks = data?.offAir
        ? []
        : [
            ...serverTracks,
            ...[...knownTracks.current.values()].filter((track) =>
              !serverTracks.some((candidate) => candidate.uid === track.uid)
              && track.startAt <= now
              && now < track.startAt + track.duration * 1000,
            ),
          ]
      const signOnReached = data?.nextOnAir != null && now >= data.nextOnAir
      const scheduleOffAir = Boolean((data?.offAir && !signOnReached) || (data?.signOffAt != null && now >= data.signOffAt && !signOnReached))
      const scheduledActive = scheduleOffAir ? [] : tracks.filter((t) => now >= t.startAt && now < t.startAt + t.duration * 1000)
      const forcedNext = forcedNextUid.current ? tracks.find((track) => track.uid === forcedNextUid.current) : undefined
      const active = scheduleOffAir
        ? []
        : [...scheduledActive, ...(forcedNext ? [forcedNext] : [])].filter((track, index, all) => all.findIndex((candidate) => candidate.uid === track.uid) === index)
      for (const slot of slots.current) {
        if (!slot.ended || !slot.uid) continue
        const finished = tracks.find((track) => track.uid === slot.uid)
        const next = finished && tracks.find((track) => track.startAt > finished.startAt && !failedUids.current.has(track.uid))
        if (next) {
          forcedNextUid.current = next.uid
          failedUids.current.add(finished.uid)
          slot.el.pause()
          slot.el.removeAttribute('src')
          slot.el.load()
          slot.uid = null
          slot.src = null
          slot.synced = false
          slot.ended = false
        } else if (finished) {
          failedUids.current.add(finished.uid)
          onStreamError?.(finished.uid)
          slot.el.pause()
          slot.el.removeAttribute('src')
          slot.el.load()
          slot.uid = null
          slot.src = null
          slot.synced = false
          slot.ended = false
        }
      }
      if (forcedNextUid.current && tracks.some((track) => track.uid === forcedNextUid.current && now >= track.startAt)) forcedNextUid.current = null
      const voiceActive = active.some((t) => t.kind === 'dj-mic')
      const config = data?.audioConfig
      // These are station-wide absolute targets: 80% daytime and 70% at
      // night, rather than multiplying 70% by the daytime master setting.
      const stationGain = (data?.nightVolumeActive ? (config?.nightVolumePercent ?? 70) : (config?.masterVolume ?? 80)) / 100
      const replayGain = config?.replayGainEnabled ? Math.pow(10, ((config.replayGainTargetLufs ?? -14) + 14) / 20) : 1
      const upcoming = scheduleOffAir ? [] : tracks.filter((t) => t.startAt > now && t.startAt - now <= PRELOAD_AHEAD_MS)
      const wanted = [...active, ...upcoming].filter((track) => !failedUids.current.has(track.uid)).slice(0, slots.current.length)
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
          slot.reloadAttempts = 0
          slot.ended = false
          slot.el.src = track.src
          slot.el.load()
        } else if (slot.src !== track.src) {
          slot.el.pause()
          slot.src = track.src
          slot.synced = false
          slot.lastPlayAttemptAt = 0
          slot.activeWaitSince = null
          slot.reloadAttempts = 0
          slot.ended = false
          slot.el.src = track.src
          slot.el.load()
        }
        const isActive = active.includes(track)
        const isPreloading = !isActive && upcoming.includes(track)
        const el = slot.el

        const canWarmup = isPreloading
        if (!playing || (!isActive && !canWarmup)) {
          slot.activeWaitSince = null
          if (!el.paused) el.pause()
          continue
        }

        const expected = Math.max(0, (now - track.startAt) / 1000)
        if (el.error || (isActive && el.ended && now < track.startAt + track.duration * 1000 - 1_000)) {
          if (slot.reloadAttempts < 3 && slot.src) {
            slot.reloadAttempts += 1
            slot.synced = false
            slot.lastPlayAttemptAt = now
            slot.activeWaitSince = now
            el.pause()
            el.src = slot.src
            el.load()
            setPlaybackIssue('The station audio hiccuped. Retrying this song…')
            continue
          }
          failedUids.current.add(track.uid)
          el.pause()
          el.removeAttribute('src')
          el.load()
          slot.uid = null
          slot.src = null
          slot.synced = false
          slot.lastPlayAttemptAt = now
          slot.reloadAttempts = 0
          onStreamError?.(track.uid)
          continue
        }
        if (el.readyState >= 1 && isActive) {
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
        const minimumReadyState = 2
        if (isActive && el.readyState < minimumReadyState && !el.ended) {
          buffering = true
          slot.activeWaitSince ??= now
          if (now - slot.activeWaitSince >= 8_000) {
            if (slot.reloadAttempts < 3 && slot.src) {
              slot.reloadAttempts += 1
              slot.synced = false
              slot.lastPlayAttemptAt = now
              slot.activeWaitSince = now
              el.pause()
              el.src = slot.src
              el.load()
              setPlaybackIssue('The stream is taking too long to load. Retrying automatically…')
            } else {
              setPlaybackIssue('This song could not load. AutoDJ is moving to the next track…')
              failedUids.current.add(track.uid)
              el.pause()
              el.removeAttribute('src')
              el.load()
              slot.uid = null
              slot.src = null
              slot.synced = false
              slot.reloadAttempts = 0
              onStreamError?.(track.uid)
            }
          }
        } else {
          slot.activeWaitSince = null
        }
        const duckGain = voiceActive && track.kind === 'music' ? 0.18 : 1
        const crossfadeGainValue = trackGain(track, now, config?.crossfaderEnabled ?? true, config?.crossfaderCurve ?? 'constant-power')
        const outputGain = clamp01(volume * stationGain * replayGain * duckGain * (isActive ? crossfadeGainValue : 0))
        if (slot.bassFilter) slot.bassFilter.gain.value = config?.bassGainDb ?? 12
        el.volume = outputGain
        if (el.paused && !el.ended && now - slot.lastPlayAttemptAt >= 1_000) {
          slot.lastPlayAttemptAt = now
          el.play().then(() => setPlaybackIssue(null)).catch((error: unknown) => {
            if (!(error instanceof DOMException) || error.name !== 'AbortError') setPlaybackIssue(playErrorMessage(error))
          })
        }
      }

      const onAir = active.length > 0
      const currentUid = active.at(-1)?.uid ?? null
      setState((prev) => {
        const next = { onAir, buffering: playing && (buffering || (!onAir && !scheduleOffAir)), offAir: scheduleOffAir, currentUid }
        return prev.onAir === next.onAir && prev.buffering === next.buffering && prev.offAir === next.offAir && prev.currentUid === next.currentUid ? prev : next
      })
    }

    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [data, playing, volume, onStreamError])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !playing) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'RJ FM',
      artist: 'STARTCOPE BETA TEAM',
      album: 'RJ FM Livestream',
      artwork: [{ src: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    })
  }, [playing])

  useEffect(
    () => () => {
      for (const slot of slots.current) {
        slot.el.pause()
        slot.el.removeAttribute('src')
        slot.bassFilter?.disconnect()
      }
      slots.current = []
      void audioContext.current?.close().catch(() => undefined)
      audioContext.current = null
    },
    [],
  )

  return { ...state, playbackIssue, unlock }
}
