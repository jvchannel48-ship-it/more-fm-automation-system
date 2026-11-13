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

function receptionProfile(watts: number) {
  if (watts === 0) return { music: 0, static: 0.82 }
  if (watts === 5000) return { music: 0.78, static: 0.12 }
  if (watts === 20000) return { music: 0.68, static: 0.18 }
  return { music: 0.98, static: 0.025 }
}

function trackGain(track: Track, now: number) {
  const elapsed = (now - track.startAt) / 1000
  const remaining = track.duration - elapsed
  const fadeIn = track.fadeIn > 0 ? curve(elapsed / track.fadeIn) : 1
  const fadeOut = track.fadeOut > 0 ? curve(remaining / track.fadeOut) : 1
  return Math.min(fadeIn, fadeOut)
}

export function useBroadcast(data: NowResponse | undefined, playing: boolean, volume: number) {
  const slots = useRef<Slot[]>([])
  const offset = useRef(0)
  const offAirAudio = useRef<HTMLAudioElement | null>(null)
  const signalContext = useRef<AudioContext | null>(null)
  const signalNoiseSource = useRef<AudioBufferSourceNode | null>(null)
  const signalNoiseGain = useRef<GainNode | null>(null)
  const [state, setState] = useState({ onAir: false, buffering: false, offAir: false })

  useEffect(() => {
    if (!data) return
    offset.current = data.serverTime - Date.now()
  }, [data])

  const unlock = useCallback(() => {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      signalContext.current ??= new AudioContextClass()
      const context = signalContext.current
      if (context.state === 'suspended') void context.resume().catch(() => undefined)
      if (!signalNoiseGain.current) {
        const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
        const samples = buffer.getChannelData(0)
        for (let i = 0; i < samples.length; i++) {
          const hiss = (Math.random() * 2 - 1) * 0.28
          const crackle = Math.random() < 0.0007 ? (Math.random() * 2 - 1) * 0.65 : 0
          samples[i] = hiss + crackle
        }
        const source = context.createBufferSource()
        source.buffer = buffer
        source.loop = true
        const bandPass = context.createBiquadFilter()
        bandPass.type = 'bandpass'
        bandPass.frequency.value = 1450
        bandPass.Q.value = 0.62
        const lowPass = context.createBiquadFilter()
        lowPass.type = 'lowpass'
        lowPass.frequency.value = 4800
        const gain = context.createGain()
        gain.gain.value = 0
        source.connect(bandPass)
        bandPass.connect(lowPass)
        lowPass.connect(gain)
        gain.connect(context.destination)
        source.start()
        signalNoiseSource.current = source
        signalNoiseGain.current = gain
      }
    }
    if (!offAirAudio.current) {
      offAirAudio.current = new Audio('/off-air-effect.mp3')
      offAirAudio.current.loop = true
      offAirAudio.current.preload = 'auto'
      offAirAudio.current.volume = 0
    }
    if (offAirAudio.current.paused) offAirAudio.current.play().catch(() => undefined)
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
    const audio = offAirAudio.current
    if (!audio) return
    if (playing && volume > 0) {
      audio.loop = true
      if (audio.paused) void audio.play().catch(() => undefined)
      const startVolume = audio.volume
      const targetVolume = state.offAir ? volume : 0
      const duration = state.offAir ? 250 : 1200
      const startTime = performance.now()
      const timer = window.setInterval(() => {
        const progress = Math.min(1, (performance.now() - startTime) / duration)
        audio.volume = clamp01(startVolume + (targetVolume - startVolume) * progress)
        if (progress >= 1) window.clearInterval(timer)
      }, 40)
      return () => window.clearInterval(timer)
    }
    audio.volume = 0
    audio.pause()
  }, [playing, volume, state.offAir])

  useEffect(() => {
    const context = signalContext.current
    const gain = signalNoiseGain.current
    if (!context || !gain) return
    const watts = data?.transmitterWatts ?? 100000
    const profile = receptionProfile(watts)
    const target = playing && volume > 0 && !state.offAir ? profile.static * volume : 0
    gain.gain.setTargetAtTime(target, context.currentTime, profile.static > 0.5 ? 0.08 : 0.2)
  }, [data?.transmitterWatts, playing, volume, state.offAir])

  useEffect(() => {
    const tick = () => {
      const now = Date.now() + offset.current
      const tracks = data?.tracks ?? []
      const signOnReached = data?.nextOnAir != null && now >= data.nextOnAir
      const scheduleOffAir = Boolean((data?.offAir && !signOnReached) || (data?.signOffAt != null && now >= data.signOffAt && !signOnReached))
      const active = scheduleOffAir ? [] : tracks.filter((t) => now >= t.startAt && now < t.startAt + t.duration * 1000)
      const voiceActive = active.some((t) => t.kind === 'dj-mic')
      const nightVolumeGain = data?.nightVolumeActive ? 0.72 : 1
      const musicSignalGain = receptionProfile(data?.transmitterWatts ?? 100000).music
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
        el.volume = clamp01(trackGain(track, now) * volume * nightVolumeGain * duckGain * musicSignalGain)
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
      if (offAirAudio.current) {
        offAirAudio.current.pause()
        offAirAudio.current.removeAttribute('src')
        offAirAudio.current.load()
      }
      offAirAudio.current = null
      signalNoiseSource.current?.stop()
      signalNoiseSource.current = null
      signalNoiseGain.current = null
      if (signalContext.current && signalContext.current.state !== 'closed') void signalContext.current.close()
      signalContext.current = null
    },
    [],
  )

  return { ...state, unlock }
}
