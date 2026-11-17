'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NowResponse } from '@/lib/types'

const STREAM_URL = '/api/stream'

export function useBroadcast(data: NowResponse | undefined, playing: boolean, volume: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const bassFilterRef = useRef<BiquadFilterNode | null>(null)
  const [state, setState] = useState({ onAir: false, buffering: false })

  const unlock = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.preload = 'none'
    audio.controls = false
    audio.setAttribute('playsinline', '')
    audio.removeAttribute('controls')
    if (!audio.src) audio.src = STREAM_URL
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      const context = audioContextRef.current ?? new AudioContextClass()
      audioContextRef.current = context
      if (!bassFilterRef.current) {
        const source = context.createMediaElementSource(audio)
        const filter = context.createBiquadFilter()
        filter.type = 'lowshelf'
        filter.frequency.value = 120
        source.connect(filter).connect(context.destination)
        bassFilterRef.current = filter
      }
      void context.resume()
    } catch {
      // Native playback remains available if Web Audio is unsupported or blocked.
    }
  }, [])

  useEffect(() => {
    const filter = bassFilterRef.current
    const context = audioContextRef.current
    if (!filter || !context) return
    const bassDb = Math.min(14, Math.max(0, data?.bassBoostDb ?? 0))
    filter.gain.setTargetAtTime(bassDb, context.currentTime, 0.08)
  }, [data?.bassBoostDb])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlaying = () => setState((previous) => ({ ...previous, buffering: false, onAir: true }))
    const onWaiting = () => setState((previous) => ({ ...previous, buffering: true }))
    const onPause = () => setState((previous) => ({ ...previous, onAir: false }))
    const onError = () => setState((previous) => ({ ...previous, buffering: false, onAir: false }))
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
      audio.pause()
      audio.removeAttribute('src')
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') void audioContextRef.current.close()
      audioContextRef.current = null
      bassFilterRef.current = null
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = Math.min(1, Math.max(0, volume))
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!playing || data?.offAir) {
      audio.pause()
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
      return
    }

    if (!audio.src) audio.src = STREAM_URL
    void audio.play().catch(() => {
      setState((previous) => ({ ...previous, buffering: false, onAir: false }))
    })
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'
  }, [data?.offAir, playing])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'MoRe FM 93.5 - LIVE',
      artist: 'Easy Listening',
      album: 'More Music',
      artwork: [{ src: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    })
    navigator.mediaSession.setActionHandler('play', () => {
      void audioRef.current?.play()
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause()
    })
    navigator.mediaSession.setActionHandler('stop', () => {
      audioRef.current?.pause()
    })

    return () => {
      navigator.mediaSession.metadata = null
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('stop', null)
    }
  }, [])

  useEffect(() => {
    setState((previous) => ({
      ...previous,
      onAir: playing && !data?.offAir,
    }))
  }, [data?.offAir, playing])

  return {
    ...state,
    audioRef,
    unlock,
  }
}
