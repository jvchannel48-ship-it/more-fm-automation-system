'use client'

import { useState } from 'react'
import { CheckCircle2, Music2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SongRequestForm() {
  const [artist, setArtist] = useState('')
  const [title, setTitle] = useState('')
  const [open, setOpen] = useState(false)
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/song-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Hindi naipadala ang request.')
      setArtist('')
      setTitle('')
      setOpen(false)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'May problema sa pagpapadala.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card/70 p-4 text-left">
        <div className="mb-3 flex items-center gap-2">
          <Music2 className="size-5 text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">Song Request</h3>
            <p className="text-xs text-muted-foreground">I-request ang paborito mong kanta</p>
          </div>
        </div>
        {!open ? (
          <Button className="w-full" onClick={() => setOpen(true)}>
            Request a Song
          </Button>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="request-artist">Artist Name</Label>
              <Input id="request-artist" value={artist} onChange={(event) => setArtist(event.target.value)} maxLength={80} required placeholder="Artist name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="request-title">Song Title</Label>
              <Input id="request-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required placeholder="Song title" />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || artist.trim().length < 2 || title.trim().length < 2} className="flex-1">
                {busy ? 'Sending...' : 'Submit Request'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setError('') }}>Cancel</Button>
            </div>
          </form>
        )}
      </div>

      {success && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="request-success-title">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
            <CheckCircle2 className="mx-auto mb-3 size-14 text-emerald-500" aria-hidden="true" />
            <h2 id="request-success-title" className="text-xl font-bold">Successful!</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your song request received.</p>
            <Button className="mt-6 w-full" onClick={() => setSuccess(false)}>
              EXIT
              <X className="ml-1 size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
