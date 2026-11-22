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
      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#111827] p-3 text-white shadow-lg"
    >
      <button
        type="button"
        onClick={togglePlayback}
        aria-label={playing ? 'Pause RJ FM 93.5' : 'Play RJ FM 93.5'}
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-950 transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
      >
        {playing ? <Pause className="size-6" fill="currentColor" /> : <Play className="ml-1 size-6" fill="currentColor" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold tracking-wide">RJ FM 93.5</p>
        <p className="mt-1 text-xs text-slate-300" aria-live="polite">
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
                    : 'Tap Play to listen'}
        </p>
      </div>
      {buffering && playing && <Loader2 className="size-4 shrink-0 animate-spin text-amber-300" aria-hidden="true" />}
    </section>
  )
}
