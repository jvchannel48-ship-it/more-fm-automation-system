'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NowResponse, Track } from '@/lib/types'

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
const PRELOAD_AHEAD_MS = 180_000
const DRIFT_TOLERANCE_S = 15

interface Slot {
  el: HTMLAudioElement
  uid: string | null
  synced: boolean
  lastPlayAttemptAt: number
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const curve = (n: number) => Math.sin((clamp01(n) * Math.PI) / 2)

function trackGain(track: Track, now: number) {
  const elapsed = (now - track.startAt) / 1000
  const remaining = track.duration - elapsed
  const fadeIn = track.fadeIn > 0 ? curve(elapsed / track.fadeIn) : 1
  const fadeOut = track.fadeOut > 0 ? curve(remaining / track.fadeOut) : 1
  return Math.min(fadeIn, fadeOut)
}

function playSignOffStatic(context: AudioContext, volume: number) {
  const now = context.currentTime
  const duration = 2.5
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < samples.length; i++) {
    const crackle = Math.random() < 0.006 ? 1.8 : 0.62
    const flutter = 0.68 + Math.sin(i / 151) * 0.2 + Math.sin(i / 37) * 0.12
    samples[i] = (Math.random() * 2 - 1) * crackle * flutter
  }

  const noise = context.createBufferSource()
  noise.buffer = buffer
  const highPass = context.createBiquadFilter()
  highPass.type = 'highpass'
  highPass.frequency.value = 280
  const lowPass = context.createBiquadFilter()
  lowPass.type = 'lowpass'
  lowPass.frequency.setValueAtTime(1800, now)
  lowPass.frequency.linearRampToValueAtTime(4800, now + 0.5)
  lowPass.frequency.setValueAtTime(3200, now + 1.5)
  lowPass.frequency.linearRampToValueAtTime(2200, now + duration)
  const noiseGain = context.createGain()
  noiseGain.gain.setValueAtTime(0.0001, now)
  noiseGain.gain.linearRampToValueAtTime(0.2 * volume, now + 0.06)
  noiseGain.gain.setValueAtTime(0.2 * volume, now + duration - 0.3)
  noiseGain.gain.linearRampToValueAtTime(0.0001, now + duration)
  noise.connect(highPass)
  highPass.connect(lowPass)
  lowPass.connect(noiseGain)
  noiseGain.connect(context.destination)
  noise.start(now)
  noise.stop(now + duration)

  const sweep = context.createOscillator()
  const sweepGain = context.createGain()
  sweep.type = 'triangle'
  sweep.frequency.setValueAtTime(1400, now)
  sweep.frequency.exponentialRampToValueAtTime(210, now + 0.42)
  sweepGain.gain.setValueAtTime(0.055 * volume, now)
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
  sweep.connect(sweepGain)
  sweepGain.connect(context.destination)
  sweep.start(now)
  sweep.stop(now + 0.45)
}

export function useBroadcast(data: NowResponse | undefined, playing: boolean, volume: number) {
  const slots = useRef<Slot[]>([])
  const offset = useRef(0)
  const signOffContext = useRef<AudioContext | null>(null)
  const lastKnownSignOffAt = useRef<number | null>(null)
  const lastPlayedSignOffAt = useRef<number | null>(null)
  const previousOffAir = useRef<boolean | null>(null)
  const [state, setState] = useState({ onAir: false, buffering: false, offAir: false })

  useEffect(() => {
    if (!data) return
    offset.current = data.serverTime - Date.now()
    if (data.signOffAt !== null) lastKnownSignOffAt.current = data.signOffAt
  }, [data])

  const unlock = useCallback(() => {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      signOffContext.current ??= new AudioContextClass()
      if (signOffContext.current.state === 'suspended') void signOffContext.current.resume().catch(() => undefined)
    }
    if (slots.current.length > 0) return
    slots.current = Array.from({ length: 5 }, () => {
      const el = new Audio()
      el.controls = false
      el.preload = 'auto'
      el.src = SILENT_WAV
      el.play().catch(() => undefined)
      return { el, uid: null, synced: false, lastPlayAttemptAt: 0 }
    })
  }, [])

  useEffect(() => {
    const signOffAt = data?.signOffAt
    if (!playing || signOffAt == null || volume <= 0 || lastPlayedSignOffAt.current === signOffAt) return
    const delay = signOffAt - (Date.now() + offset.current)
    if (delay < -15_000) return
    const timer = window.setTimeout(() => {
      const context = signOffContext.current
      if (!context || context.state !== 'running' || volume <= 0 || lastPlayedSignOffAt.current === signOffAt) return
      lastPlayedSignOffAt.current = signOffAt
      playSignOffStatic(context, volume)
    }, Math.max(0, delay))
    return () => window.clearTimeout(timer)
  }, [data?.signOffAt, playing, volume])

  useEffect(() => {
    if (!data) return
    const wasOnAir = previousOffAir.current === false
    previousOffAir.current = data.offAir
    if (!wasOnAir || !data.offAir || !playing || volume <= 0) return

    const cueAt = data.signOffAt ?? lastKnownSignOffAt.current
    const justSignedOff = data.signOffAt !== null || (cueAt !== null && Math.abs(Date.now() + offset.current - cueAt) <= 20_000)
    const context = signOffContext.current
    if (!justSignedOff || cueAt === null || !context || context.state !== 'running' || lastPlayedSignOffAt.current === cueAt) return

    lastPlayedSignOffAt.current = cueAt
    playSignOffStatic(context, volume)
  }, [data?.offAir, data?.signOffAt, playing, volume])

  useEffect(() => {
    const tick = () => {
      const now = Date.now() + offset.current
      const tracks = data?.tracks ?? []
      const scheduleOffAir = Boolean(data?.offAir || (data?.signOffAt != null && now >= data.signOffAt))
      const active = scheduleOffAir ? [] : tracks.filter((t) => now >= t.startAt && now < t.startAt + t.duration * 1000)
      const voiceActive = active.some((t) => t.kind === 'dj-mic')
      const nightVolumeGain = data?.nightVolumeActive ? 0.72 : 1
      const upcoming = scheduleOffAir ? [] : tracks.filter((t) => t.startAt > now && t.startAt - now < PRELOAD_AHEAD_MS)
      const wanted = [...active, ...upcoming].slice(0, slots.current.length)
      const wantedIds = new Set(wanted.map((t) => t.uid))

      for (const slot of slots.current) {
        if (slot.uid && !wantedIds.has(slot.uid)) {
          slot.el.pause()
          slot.uid = null
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
          slot.synced = false
          slot.lastPlayAttemptAt = 0
          slot.el.src = track.src
          slot.el.load()
        }
        const isActive = active.includes(track)
        const el = slot.el

        if (!playing || !isActive) {
          if (!el.paused) el.pause()
          continue
        }

        const expected = (now - track.startAt) / 1000
        if (el.readyState >= 1) {
          const drift = Math.abs(el.currentTime - expected)
          if (!slot.synced || (drift > DRIFT_TOLERANCE_S && el.readyState >= 3 && !el.seeking)) {
            if (!el.duration || expected < el.duration - 1) el.currentTime = Math.max(0, expected)
            slot.synced = true
          }
        }
        if (el.readyState < 3 && !el.ended) buffering = true
        const duckGain = voiceActive && track.kind === 'music' ? 0.18 : 1
        el.volume = clamp01(trackGain(track, now) * volume * nightVolumeGain * duckGain)
        if (el.paused && !el.ended && now - slot.lastPlayAttemptAt >= 1_000) {
          slot.lastPlayAttemptAt = now
          el.play().catch(() => undefined)
        }
      }

      const onAir = active.length > 0
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
      if (signOffContext.current && signOffContext.current.state !== 'closed') void signOffContext.current.close()
      signOffContext.current = null
    },
    [],
  )

  return { ...state, unlock }
}
