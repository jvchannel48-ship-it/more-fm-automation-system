'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, MessageCircle, X } from 'lucide-react'
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
    setMessage('Hinahanap at inihahanda ang kanta...')
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
      <Button type="button" variant="outline" className="h-10 w-full max-w-xs" onClick={() => setOpen(true)}>
        <MessageCircle aria-hidden="true" />
        Request a song
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <section role="dialog" aria-modal="true" aria-labelledby="song-request-title" className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-left shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="song-request-title" className="text-lg font-semibold">Song request</h2>
                <p className="mt-1 text-sm text-muted-foreground">Ilagay ang title at artist. Ihahanda ng AutoDJ ang kanta at ipi-play sa susunod na slot.</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Close song request" onClick={close}>
                <X aria-hidden="true" />
              </Button>
            </div>

            {status === 'success' ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-live/30 bg-live/10 p-5 text-center">
                <CheckCircle2 className="size-9 text-live" aria-hidden="true" />
                <p className="text-sm font-medium">{message}</p>
                <p className="text-xs text-muted-foreground">Hintayin matapos ang kasalukuyang kanta; automatic itong susunod.</p>
                <Button type="button" className="mt-2" onClick={close}>Done</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="request-title">Song title</Label>
                  <Input id="request-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Hal. Ikaw" maxLength={120} required disabled={status === 'submitting'} autoFocus />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="request-artist">Artist</Label>
                  <Input id="request-artist" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Hal. Yeng Constantino" maxLength={120} required disabled={status === 'submitting'} />
                </div>
                {message && <p className="text-sm text-destructive" role="alert">{message}</p>}
                <Button type="submit" disabled={status === 'submitting' || !title.trim() || !artist.trim()}>
                  {status === 'submitting' ? <><Loader2 className="animate-spin" aria-hidden="true" /> Submitting...</> : <><MessageCircle aria-hidden="true" /> Submit request</>}
                </Button>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  )
}
