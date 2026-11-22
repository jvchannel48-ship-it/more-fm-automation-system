'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Loader2, Pause, Play } from 'lucide-react'
import { useBroadcast } from '@/hooks/use-broadcast'
import type { NowResponse } from '@/lib/types'

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((response) => {
    if (!response.ok) throw new Error('RJ FM is unavailable')
    return response.json() as Promise<NowResponse>
  })

/** A minimal, station-locked player intended to run inside third-party iframes. */
export function RjFmEmbedPlayer() {
  const [playing, setPlaying] = useState(false)
  const { data, error } = useSWR('/api/now?station=main', fetcher, {
    refreshInterval: playing ? 3000 : 15000,
    revalidateOnFocus: true,
  })
  const { buffering, playbackIssue, unlock } = useBroadcast(data, playing, 1, undefined, 'main')

  const togglePlayback = () => {
    if (!playing) unlock()
    setPlaying((current) => !current)
  }

  return (
    <section
      aria-label="RJ FM 93.5 player"
      className="rjfm-embed-shell relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-amber-200/20 p-4 text-white shadow-2xl"
    >
      <div className="rjfm-embed-glow" aria-hidden="true" />
      <div className={`rjfm-embed-vinyl relative z-10 flex size-[76px] shrink-0 items-center justify-center rounded-full ${playing && !data?.offAir ? 'is-playing' : ''}`}>
        <span className="rjfm-embed-vinyl-grooves absolute inset-[5px] rounded-full" aria-hidden="true" />
        <span className="rjfm-embed-label absolute inset-[25%] rounded-full" aria-hidden="true" />
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={playing ? 'Pause RJ FM 93.5' : 'Play RJ FM 93.5'}
          className="rjfm-embed-play relative z-10 flex size-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
        >
          {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="ml-0.5 size-5" fill="currentColor" />}
        </button>
      </div>
      <div className="relative z-10 min-w-0 flex-1">
        <p className="truncate text-base font-black tracking-[0.12em]">RJ FM <span className="text-amber-300">93.5</span></p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-100/70">All Day Long · Live Radio</p>
        <p className="mt-2 text-xs text-slate-300" aria-live="polite">
          {error && !data
            ? 'Unable to connect. Retrying…'
            : data?.offAir
              ? 'Currently off air'
              : buffering && playing
                ? 'Connecting to live radio…'
                : playbackIssue && playing
                  ? 'Tap Play to resume audio'
                  : playing
                    ? 'Now playing'
                    : 'Tap the button to listen'}
        </p>
      </div>
      {buffering && playing && <Loader2 className="relative z-10 size-4 shrink-0 animate-spin text-amber-300" aria-hidden="true" />}
    </section>
  )
}
