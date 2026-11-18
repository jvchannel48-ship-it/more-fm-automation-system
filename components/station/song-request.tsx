'use client'

import { useState } from 'react'
import { CheckCircle2, MessageCircle, Radio, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type RequestStatus = 'idle' | 'submitting' | 'success' | 'error'

export function SongRequest() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [message, setMessage] = useState('')

  const close = () => {
    if (status === 'submitting') return
    setOpen(false)
    setStatus('idle')
    setMessage('')
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('submitting')
    setMessage('')
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist }),
        cache: 'no-store',
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string; position?: number }
      if (!response.ok) throw new Error(data.error || 'Hindi ma-submit ang song request.')
      setStatus('success')
      setMessage(
        data.position && data.position > 1
          ? `Successful! Naka-queue ka sa #${data.position}. Ipe-play pagkatapos ng mga naunang request.`
          : 'Successful! Naka-queue na ang kanta at ipe-play sa susunod pagkatapos ng kasalukuyang kanta.',
      )
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Hindi ma-submit ang song request.')
    }
  }

  return (
    <>
      <Button type="button" className="h-11 w-full max-w-xs bg-primary/15 text-primary ring-1 ring-primary/30 hover:bg-primary/25" onClick={() => setOpen(true)}>
        <MessageCircle aria-hidden="true" />
        Make a song request
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <section role="dialog" aria-modal="true" aria-labelledby="song-request-title" className="relative w-full max-w-md overflow-hidden rounded-3xl border border-primary/25 bg-card/95 text-left shadow-2xl shadow-black/50">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20" aria-hidden="true" />
            <div className="p-6 sm:p-7">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
                    <Radio className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">On-air request line</p>
                    <h2 id="song-request-title" className="text-xl font-semibold tracking-tight">Choose your next song</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Enter the song title and artist. Your request will be queued for the next available slot.</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Close song request" onClick={close}>
                  <X aria-hidden="true" />
                </Button>
              </div>

              {status === 'success' ? (
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-live/30 bg-live/10 p-6 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-live/15 ring-1 ring-live/30">
                    <CheckCircle2 className="size-8 text-live" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-base font-semibold">Song request successful</p>
                    <p className="mt-1 text-sm text-muted-foreground">{message}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Hintayin matapos ang kasalukuyang kanta; automatic itong susunod.</p>
                  <Button type="button" className="mt-1 h-10 w-full" onClick={close}>Done</Button>
                </div>
              ) : (
                <form onSubmit={submit} className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="request-title">Song title</Label>
                      <Input id="request-title" className="h-10 bg-background/60" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Hal. Ikaw" maxLength={120} required disabled={status === 'submitting'} autoFocus />
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      <Label htmlFor="request-artist">Artist</Label>
                      <Input id="request-artist" className="h-10 bg-background/60" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Hal. Yeng Constantino" maxLength={120} required disabled={status === 'submitting'} />
                    </div>
                  </div>

                  {status === 'submitting' && (
                    <div className="space-y-2" role="status" aria-live="polite">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label="Submitting song request" aria-busy="true">
                        <div className="h-full w-1/3 rounded-full bg-primary" style={{ animation: 'request-progress 1.2s ease-in-out infinite' }} />
                      </div>
                    </div>
                  )}
                  {status === 'error' && message && <p className="text-sm text-destructive" role="alert">{message}</p>}
                  <Button type="submit" className="h-11 w-full" disabled={status === 'submitting' || !title.trim() || !artist.trim()}>
                    <MessageCircle aria-hidden="true" /> Submit request
                  </Button>
                </form>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
