'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NowResponse, Track } from '@/lib/types'

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
const PRELOAD_AHEAD_MS = 25_000
const DRIFT_TOLERANCE_S = 4

interface Slot {
  el: HTMLAudioElement
  uid: string | null
  synced: boolean
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

export function useBroadcast(data: NowResponse | undefined, playing: boolean, volume: number) {
  const slots = useRef<Slot[]>([])
  const offset = useRef(0)
  const [state, setState] = useState({ onAir: false, buffering: false })

  useEffect(() => {
    if (data) offset.current = data.serverTime - Date.now()
  }, [data])

  const unlock = useCallback(() => {
    if (slots.current.length > 0) return
    slots.current = Array.from({ length: 3 }, () => {
      const el = new Audio()
      el.preload = 'auto'
      el.src = SILENT_WAV
      el.play().catch(() => undefined)
      return { el, uid: null, synced: false }
    })
  }, [])

  useEffect(() => {
    const tick = () => {
      const now = Date.now() + offset.current
      const tracks = data?.tracks ?? []
      const active = tracks.filter((t) => now >= t.startAt && now < t.startAt + t.duration * 1000)
      const upcoming = tracks.filter((t) => t.startAt > now && t.startAt - now < PRELOAD_AHEAD_MS)
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
          if (!slot.synced || Math.abs(el.currentTime - expected) > DRIFT_TOLERANCE_S) {
            if (!el.duration || expected < el.duration - 1) el.currentTime = Math.max(0, expected)
            slot.synced = true
          }
        }
        if (el.readyState < 3 && !el.ended) buffering = true
        el.volume = clamp01(trackGain(track, now) * volume)
        if (el.paused && !el.ended) el.play().catch(() => undefined)
      }

      const onAir = active.length > 0
      setState((prev) => {
        const next = { onAir, buffering: playing && (buffering || !onAir) }
        return prev.onAir === next.onAir && prev.buffering === next.buffering ? prev : next
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
      album: 'created by DWLC',
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

  return { ...state, unlock }
}
