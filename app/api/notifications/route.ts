import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { addNotification, getNotifications, MAX_ATTACHMENT_BYTES } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } }

export async function GET() {
  return NextResponse.json({ notifications: await getNotifications() }, noStore)
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Admin login required.' }, { status: 401, ...noStore })
  }

  const form = await request.formData()
  const title = String(form.get('title') ?? '').trim()
  const message = String(form.get('message') ?? '').trim()
  const confirmed = form.get('confirmed') === 'true'
  const file = form.get('file')

  if (!confirmed) return NextResponse.json({ error: 'Confirm the notification before sending.' }, { status: 400, ...noStore })
  if (!title || title.length > 120) return NextResponse.json({ error: 'Title is required and must be 120 characters or less.' }, { status: 400, ...noStore })
  if (!message || message.length > 3000) return NextResponse.json({ error: 'Message is required and must be 3000 characters or less.' }, { status: 400, ...noStore })

  let attachment: { name: string; type: string; dataUrl: string } | undefined
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: 'Attachment is too large. Maximum size is 1.5 MB.' }, { status: 400, ...noStore })
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('text/')) {
      return NextResponse.json({ error: 'Only image or text file attachments are supported.' }, { status: 400, ...noStore })
    }
    const bytes = Buffer.from(await file.arrayBuffer())
    attachment = {
      name: file.name.slice(0, 160),
      type: file.type || 'application/octet-stream',
      dataUrl: `data:${file.type || 'application/octet-stream'};base64,${bytes.toString('base64')}`,
    }
  }

  try {
    const result = await addNotification({ title, message, ...(attachment ? { attachment } : {}) })
    return NextResponse.json(result, noStore)
  } catch (error) {
    console.error('[morefm] notification send failed', error)
    return NextResponse.json({ error: 'Could not send the notification.' }, { status: 503, ...noStore })
  }
}
