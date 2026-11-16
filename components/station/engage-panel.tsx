'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Heart, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

async function readApiJson<T>(response: Response): Promise<T> {
  const result = await response.json().catch(() => null) as (T & { error?: unknown }) | null
  if (!response.ok) {
    const message = result && typeof result.error === 'string' ? result.error : `Request failed (${response.status}).`
    throw new Error(message)
  }
  if (result === null) throw new Error('The server returned an empty response. Please try again.')
  return result
}

function browserId() {
  let id = localStorage.getItem('morefm-voter-id')
  if (!id) {
    id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `voter-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem('morefm-voter-id', id)
  }
  return id
}

export function EngagePanel() {
  const [ratingTotal, setRatingTotal] = useState(0)
  const [rated, setRated] = useState(false)
  const [ratingBusy, setRatingBusy] = useState(false)
  const [ratingMessage, setRatingMessage] = useState('')
  const [ratingError, setRatingError] = useState('')

  useEffect(() => {
    setRated(localStorage.getItem('morefm-rated') === 'true')
    void fetch('/api/rating', { cache: 'no-store' })
      .then((response) => readApiJson<{ total?: number }>(response))
      .then((result) => setRatingTotal(result.total ?? 0))
      .catch(() => undefined)
  }, [])

  const rate = async () => {
    if (rated || ratingBusy) return
    setRatingBusy(true)
    setRatingMessage('')
    setRatingError('')
    try {
      const response = await fetch('/api/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId: browserId() }),
      })
      const result = await readApiJson<{ total?: number }>(response)
      setRatingTotal(result.total ?? ratingTotal)
      setRated(true)
      localStorage.setItem('morefm-rated', 'true')
      setRatingMessage('Thanks for rating us! Your support means a lot.')
    } catch (reason) {
      setRatingError(reason instanceof Error ? reason.message : 'Your rating could not be saved. Please try again.')
    } finally {
      setRatingBusy(false)
    }
  }

  return <div className="flex w-full max-w-md flex-col gap-3">
    <div className="flex w-full flex-wrap items-center justify-center gap-3">
      <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/45 py-1 pl-1 pr-3 shadow-sm">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => void rate()}
          disabled={rated || ratingBusy}
          className={`size-11 rounded-full transition-colors ${rated ? 'text-rose-400' : 'hover:text-rose-400'}`}
          aria-label={rated ? 'Thanks for rating MOR 93.5' : 'Rate MOR 93.5'}
          title={rated ? 'You rated this station' : 'Rate this station'}
        >
          {ratingBusy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Heart className={rated ? 'fill-current' : undefined} aria-hidden="true" />}
        </Button>
        <span className="min-w-12 text-left text-xs leading-tight text-muted-foreground">
          <span className="block font-semibold text-foreground">{ratingTotal}</span>
          <span>{ratingTotal === 1 ? 'rating' : 'ratings'}</span>
        </span>
      </div>
    </div>

    {ratingMessage && <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left text-emerald-100" role="status" aria-live="polite">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden="true" />
      <div><p className="text-sm font-semibold">Rating received</p><p className="text-xs text-emerald-100/80">{ratingMessage}</p></div>
    </div>}
    {ratingError && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{ratingError}</p>}
  </div>
}
