'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NowResponse } from '@/lib/types'

const STREAM_URL = '/api/stream'

export function useBroadcast(
  data: NowResponse | undefined,
  playing: boolean,
  volume: number,
  onPlaybackChange: (playing: boolean) => void,
) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [state, setState] = useState({ onAir: false, buffering: false })

  const unlock = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.preload = 'none'
    audio.controls = false
    audio.setAttribute('playsinline', '')
    audio.removeAttribute('controls')
    if (!audio.src) audio.src = STREAM_URL
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlaying = () => {
      setState((previous) => ({ ...previous, buffering: false, onAir: true }))
      onPlaybackChange(true)
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'
    }
    const onWaiting = () => setState((previous) => ({ ...previous, buffering: true }))
    const onPause = () => {
      setState((previous) => ({ ...previous, onAir: false }))
      onPlaybackChange(false)
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
    }
    const onError = () => {
      setState((previous) => ({ ...previous, buffering: false, onAir: false }))
      onPlaybackChange(false)
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
    }

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
    }
  }, [onPlaybackChange])

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
      onPlaybackChange(false)
    })
  }, [data?.offAir, onPlaybackChange, playing])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'MoRe FM 93.5 - LIVE',
      artist: 'Easy Listening',
      album: 'More Music',
      artwork: [{ src: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    })
    navigator.mediaSession.setActionHandler('play', () => {
      unlock()
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
  }, [unlock])

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
