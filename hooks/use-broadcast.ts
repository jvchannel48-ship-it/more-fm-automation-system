'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_BASS_BOOST_DB, type NowResponse, type Track } from '@/lib/types'

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
const PRELOAD_AHEAD_MS = 240_000
const PRELOAD_DJ_VOICE_AHEAD_MS = 10 * 60_000
const DRIFT_TOLERANCE_S = 15
const MAX_MEDIA_RETRIES = 10
const RETRY_BACKOFF_MS = 2_000
const START_TIMEOUT_MS = 20_000
const DJ_VOICE_START_TIMEOUT_MS = 55_000

interface Slot {
  el: HTMLAudioElement
  uid: string | null
  src: string | null
  synced: boolean
  bassHighPass: BiquadFilterNode | null
  bassFilter: BiquadFilterNode | null
  bassHeadroom: GainNode | null
  activeWaitSince: number | null
  lastRetryAt: number
  lastPlayAttemptAt: number
  retryAttempts: number
}

interface PlaybackState {
  onAir: boolean
  buffering: boolean
  playbackIssue: string | null
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const curve = (n: number) => Math.sin((clamp01(n) * Math.PI) / 2)
// Keep the full 12 dB shelf while reserving 6 dB of peak headroom at maximum boost.
const bassHeadroomFor = (db: number) => Math.pow(10, -(db * 0.5) / 20)

function trackGain(track: Track, now: number) {
  const elapsed = (now - track.startAt) / 1000
  const remaining = track.duration - elapsed
  const fadeIn = track.fadeIn > 0 ? curve(elapsed / track.fadeIn) : 1
  const fadeOut = track.fadeOut > 0 ? curve(remaining / track.fadeOut) : 1
  return Math.min(fadeIn, fadeOut)
}

export function useBroadcast(
  data: NowResponse | undefined,
  playing: boolean,
  volume: number,
  onStreamError?: (uid: string) => void,
  stationId = 'main',
) {
  const slots = useRef<Slot[]>([])
  const audioContext = useRef<AudioContext | null>(null)
  const bassDb = useRef(0)
  const offset = useRef(0)
  const failedUids = useRef(new Set<string>())
  const [state, setState] = useState<PlaybackState>({ onAir: false, buffering: false, playbackIssue: null })

  useEffect(() => {
    const nextDb = Math.min(MAX_BASS_BOOST_DB, Math.max(0, data?.bassBoostDb ?? MAX_BASS_BOOST_DB))
    bassDb.current = nextDb
    for (const slot of slots.current) {
      const filter = slot.bassFilter
      if (filter) filter.gain.setTargetAtTime(nextDb, filter.context.currentTime, 0.08)
      const headroom = slot.bassHeadroom
      if (headroom) headroom.gain.setTargetAtTime(bassHeadroomFor(nextDb), headroom.context.currentTime, 0.08)
    }
  }, [data?.bassBoostDb])

  useEffect(() => {
    if (data) offset.current = data.serverTime - Date.now()
  }, [data])

  useEffect(() => {
    if (!playing || !data?.offAir || stationId !== 'main' || volume <= 0) return
    const context = audioContext.current
    if (!context || context.state === 'closed') return
    if (context.state === 'suspended') void context.resume().catch(() => undefined)
    let stopped = false
    const playStatic = () => {
      if (stopped || context.state === 'closed') return
      const length = Math.floor(context.sampleRate * 0.28)
      const buffer = context.createBuffer(1, length, context.sampleRate)
      const channel = buffer.getChannelData(0)
      for (let index = 0; index < length; index++) {
        const envelope = Math.min(1, index / (length * 0.08), (length - index) / (length * 0.18))
        channel[index] = (Math.random() * 2 - 1) * 0.72 * Math.max(0, envelope)
      }
      const source = context.createBufferSource()
      const gain = context.createGain()
      gain.gain.value = Math.min(0.24, volume * 0.34)
      source.buffer = buffer
      source.connect(gain).connect(context.destination)
      source.start()
    }
    playStatic()
    const interval = window.setInterval(playStatic, 700)
    return () => { stopped = true; window.clearInterval(interval) }
  }, [data?.offAir, playing, stationId, volume])

  const unlock = useCallback(() => {
    if (slots.current.length > 0) return
    let context = audioContext.current
    if (!context) {
      try {
        context = new AudioContext()
        audioContext.current = context
      } catch {
        context = null
      }
    }
    if (context?.state === 'suspended') void context.resume().catch(() => undefined)
    slots.current = Array.from({ length: 6 }, () => {
      const el = new Audio()
      el.preload = 'auto'
      // Remove only this device's temporary offline copy after the track finishes.
      // The original MP3 and the server playlist are never modified.
      el.addEventListener('ended', () => {
        const playedUrl = el.currentSrc || el.src
        if (el.dataset.rjfmAutoDelete === 'true' && playedUrl && 'serviceWorker' in navigator) {
          const message = { type: 'RJFM_PURGE_PLAYED_AUDIO', url: playedUrl }
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage(message)
          } else {
            void navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage(message)).catch(() => undefined)
          }
        }
      })
      el.setAttribute('playsinline', '')
      el.setAttribute('webkit-playsinline', '')
      let bassHighPass: BiquadFilterNode | null = null
      let bassFilter: BiquadFilterNode | null = null
      let bassHeadroom: GainNode | null = null
      if (context) {
        try {
          const source = context.createMediaElementSource(el)
          bassHeadroom = context.createGain()
          bassHeadroom.gain.value = bassHeadroomFor(bassDb.current)
          bassHighPass = context.createBiquadFilter()
          bassHighPass.type = 'highpass'
          bassHighPass.frequency.value = 35
          bassHighPass.Q.value = 0.7
          bassFilter = context.createBiquadFilter()
          bassFilter.type = 'lowshelf'
          bassFilter.frequency.value = 90
          bassFilter.gain.value = bassDb.current
          const limiter = context.createDynamicsCompressor()
          limiter.threshold.value = -10
          limiter.knee.value = 24
          limiter.ratio.value = 3
          limiter.attack.value = 0.01
          limiter.release.value = 0.25
          source.connect(bassHighPass).connect(bassHeadroom).connect(bassFilter).connect(limiter).connect(context.destination)
        } catch {
          bassHighPass = null
          bassFilter = null
          bassHeadroom = null
        }
      }
      el.src = SILENT_WAV
      el.play().catch(() => undefined)
      return {
        el,
        uid: null,
        src: null,
        synced: false,
        bassHighPass,
        bassFilter,
        bassHeadroom,
        activeWaitSince: null,
        lastRetryAt: 0,
        lastPlayAttemptAt: 0,
        retryAttempts: 0,
      }
    })
  }, [])

  useEffect(() => {
    const tick = () => {
      const now = Date.now() + offset.current
      const tracks = data?.tracks ?? []
      const presentIds = new Set(tracks.map((track) => track.uid))
      for (const uid of failedUids.current) {
        if (!presentIds.has(uid)) failedUids.current.delete(uid)
      }

      const availableTracks = tracks.filter((track) => !failedUids.current.has(track.uid))
      const active = availableTracks
        .filter((track) => now >= track.startAt && now < track.startAt + track.duration * 1000)
        .sort((a, b) => a.startAt - b.startAt)
      const activeIds = new Set(active.map((track) => track.uid))
      const upcomingMusic = availableTracks
        .filter((track) => track.kind === 'music' && track.startAt > now)
        .sort((a, b) => a.startAt - b.startAt)
      // Always warm the next two songs, even when the second one starts after
      // Christopher's time check. Voice clips are preloaded too, but never count
      // as a substitute for an upcoming music track.
      const protectedMusicIds = new Set(upcomingMusic.slice(0, PRELOAD_AHEAD_TRACKS).map((track) => track.uid))
      const upcoming = availableTracks
        .filter((track) => !activeIds.has(track.uid)
          && track.startAt > now
          && (track.startAt - now < PRELOAD_AHEAD_MS
            || protectedMusicIds.has(track.uid)
            || (track.kind === 'dj-mic' && track.startAt - now < PRELOAD_DJ_VOICE_AHEAD_MS)))
        .sort((a, b) => a.startAt - b.startAt)
      const wanted = [...active, ...upcoming].slice(0, slots.current.length)
      const wantedIds = new Set(wanted.map((t) => t.uid))

      for (const slot of slots.current) {
        if (slot.uid && !wantedIds.has(slot.uid)) {
          slot.el.pause()
          slot.el.removeAttribute('src')
          slot.el.load()
          slot.uid = null
          slot.src = null
          slot.synced = false
          slot.activeWaitSince = null
          slot.lastRetryAt = 0
          slot.lastPlayAttemptAt = 0
          slot.retryAttempts = 0
        }
      }

      const retrySource = (slot: Slot, track: Track) => {
        if (slot.retryAttempts >= MAX_MEDIA_RETRIES) return false
        if (now - slot.lastRetryAt < RETRY_BACKOFF_MS) return true
        slot.retryAttempts += 1
        slot.lastRetryAt = now
        slot.activeWaitSince = now
        slot.synced = false
        slot.el.pause()
        slot.el.removeAttribute('src')
        slot.el.load()
        slot.src = track.src
        slot.el.src = track.src
        slot.el.load()
        return true
      }

      const failSource = (slot: Slot, track: Track) => {
        if (failedUids.current.has(track.uid)) return
        failedUids.current.add(track.uid)
        slot.el.pause()
        slot.el.removeAttribute('src')
        slot.el.load()
        slot.uid = null
        slot.src = null
        slot.synced = false
        slot.activeWaitSince = null
        setState((previous) => ({
          ...previous,
          playbackIssue: track.kind === 'live'
            ? 'Nagkaproblema ang live stream; susubukan ang RJ FM music.'
            : 'Nagkaproblema ang source; lilipat sa susunod na kanta.',
        }))
        onStreamError?.(track.uid)
      }

      for (const track of wanted) {
        let slot = slots.current.find((s) => s.uid === track.uid)
        if (!slot) {
          slot = slots.current.find((s) => s.uid === null)
          if (!slot) continue
          slot.uid = track.uid
          slot.src = track.src
          slot.synced = false
          slot.activeWaitSince = null
          slot.lastRetryAt = 0
          slot.lastPlayAttemptAt = 0
          slot.retryAttempts = 0
          slot.el.src = track.src
          slot.el.load()
        } else if (slot.src !== track.src) {
          slot.src = track.src
          slot.synced = false
          slot.retryAttempts = 0
          slot.lastRetryAt = 0
          slot.el.src = track.src
          slot.el.load()
        }
        const isActive = activeIds.has(track.uid)
        const el = slot.el
        el.dataset.rjfmAutoDelete = String(data?.autoDeletePlayedCache !== false)

        if (!playing) {
          if (!el.paused) el.pause()
          continue
        }

        if (!isActive) {
          if (!el.paused) el.pause()
          continue
        }

        const endsAt = track.startAt + track.duration * 1000
        const endedEarly = el.ended && now < endsAt - 1_500
        if (el.error || endedEarly) {
          if (retrySource(slot, track)) continue
          failSource(slot, track)
          continue
        }

        // Start the browser's media pipeline immediately on the first Play tap.
        // HTMLMediaElement.play() can be called while data is still buffering; waiting
        // for HAVE_CURRENT_DATA here delayed the initial request and audible playback.
        if (el.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          if (slot.activeWaitSince === null) slot.activeWaitSince = now
          const startTimeout = track.kind === 'dj-mic' ? DJ_VOICE_START_TIMEOUT_MS : START_TIMEOUT_MS
          if (now - slot.activeWaitSince >= startTimeout) {
            if (retrySource(slot, track)) continue
            failSource(slot, track)
            continue
          }
        } else {
          slot.activeWaitSince = null
        }

        const expected = (now - track.startAt) / 1000
        if (track.kind !== 'live' && el.readyState >= HTMLMediaElement.HAVE_METADATA) {
          if (!slot.synced || Math.abs(el.currentTime - expected) > DRIFT_TOLERANCE_S) {
            if (expected < 0 || !el.duration || expected < el.duration - 1) {
              el.currentTime = Math.max(0, expected)
            }
            slot.synced = true
          }
        }

        const liveDuck = data?.liveDj?.active ? 0.38 : 1
        el.volume = clamp01(trackGain(track, now) * volume * liveDuck)
        if (el.paused && !el.ended && now - slot.lastPlayAttemptAt >= 1_000) {
          slot.lastPlayAttemptAt = now
          void el.play().then(() => {
            setState((previous) => previous.playbackIssue
              ? { ...previous, playbackIssue: null }
              : previous)
          }).catch((error: unknown) => {
            if (!playing || slot.uid !== track.uid || failedUids.current.has(track.uid)) return
            if (error instanceof DOMException && error.name === 'NotAllowedError') {
              setState((previous) => ({
                ...previous,
                playbackIssue: 'Pindutin ulit ang Play para payagan ng browser ang audio.',
              }))
            } else if (!retrySource(slot, track)) {
              failSource(slot, track)
            }
          })
        }
      }

      const onAir = active.some((track) => {
        const slot = slots.current.find((candidate) => candidate.uid === track.uid)
        return Boolean(slot && !slot.el.paused && slot.el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
      })
      setState((prev) => {
        const next = { ...prev, onAir, buffering: playing && !onAir }
        return prev.onAir === next.onAir && prev.buffering === next.buffering ? prev : next
      })
    }

    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [data, onStreamError, playing, volume])

  useEffect(
    () => () => {
      for (const slot of slots.current) {
        slot.el.pause()
        slot.el.removeAttribute('src')
      }
      slots.current = []
      if (audioContext.current && audioContext.current.state !== 'closed') {
        void audioContext.current.close().catch(() => undefined)
      }
      audioContext.current = null
    },
    [],
  )

  return { ...state, unlock }
}
