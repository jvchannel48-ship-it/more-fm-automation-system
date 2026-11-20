'use client'

import { useState } from 'react'
import { MessageSquare, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function MessageButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('sending')
    setError('')
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromName: name.trim() || 'Listener', body: body.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send message')
      setStatus('sent')
      setBody('')
    } catch (reason) {
      setStatus('error')
      setError(reason instanceof Error ? reason.message : 'Could not send message')
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon" aria-label="Message the station" title="Message" onClick={() => { setOpen(true); setStatus('idle'); setError('') }}>
        <MessageSquare aria-hidden="true" />
      </Button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-3xl border border-primary/25 bg-card p-6 text-left shadow-2xl">
            <Button type="button" variant="ghost" size="icon-sm" className="absolute right-4 top-4" aria-label="Close" onClick={() => setOpen(false)}><X /></Button>
            <h2 className="text-xl font-semibold">Message RJ FM</h2>
            <p className="mt-1 text-sm text-muted-foreground">Send a short note to the admin desk.</p>
            {status === 'sent' ? (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-emerald-300">Message sent. The admin will see it in the panel.</p>
                <Button type="button" className="w-full" onClick={() => setOpen(false)}>Done</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
                <div>
                  <Label htmlFor="msg-name">Your name</Label>
                  <Input id="msg-name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Optional" />
                </div>
                <div>
                  <Label htmlFor="msg-body">Message</Label>
                  <textarea id="msg-body" required maxLength={500} rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your message..." className="mt-1 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={status === 'sending' || !body.trim()}>{status === 'sending' ? 'Sending…' : 'Send message'}</Button>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  )
}
