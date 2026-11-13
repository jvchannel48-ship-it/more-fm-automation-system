'use client'

import { useState, type FormEvent } from 'react'
import { Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const FEEDBACK_EMAIL = 'jvchannel48@gmail.com'

export function FeedbackForm() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = message.trim()
    if (!text) return
    const subject = encodeURIComponent('MOR 93.5 Naga — Report / Feedback')
    const body = encodeURIComponent(text)
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`
    setOpen(false)
  }

  return (
    <div className="relative">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Mail aria-hidden="true" /> Feedback
      </Button>
      {open && (
        <form onSubmit={submit} className="absolute right-0 top-full z-50 mt-2 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-2xl">
          <div>
            <Label htmlFor="station-feedback-message">Enter your message or report</Label>
            <textarea
              id="station-feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={2000}
              required
              rows={5}
              placeholder="Write your feedback or report here…"
              className="mt-2 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            This opens your email app addressed to <a className="text-primary underline" href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a>. Review the message and press Send to deliver it.
          </p>
          <Button type="submit" disabled={!message.trim()}>
            <Send aria-hidden="true" /> Open email to send
          </Button>
        </form>
      )}
    </div>
  )
}
