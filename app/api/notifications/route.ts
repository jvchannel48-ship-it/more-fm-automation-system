import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { addNotification, getNotifications, MAX_ATTACHMENT_BYTES, MAX_NOTIFICATION_ATTACHMENTS } from '@/lib/notifications'

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
  const files = form.getAll('files').filter((value): value is File => value instanceof File && value.size > 0)
  const legacyFile = form.get('file')
  if (files.length === 0 && legacyFile instanceof File && legacyFile.size > 0) files.push(legacyFile)

  if (!confirmed) return NextResponse.json({ error: 'Confirm the notification before sending.' }, { status: 400, ...noStore })
  if (!title || title.length > 120) return NextResponse.json({ error: 'Title is required and must be 120 characters or less.' }, { status: 400, ...noStore })
  if (!message || message.length > 3000) return NextResponse.json({ error: 'Message is required and must be 3000 characters or less.' }, { status: 400, ...noStore })

  if (files.length > MAX_NOTIFICATION_ATTACHMENTS) {
    return NextResponse.json({ error: `You can attach up to ${MAX_NOTIFICATION_ATTACHMENTS} images.` }, { status: 400, ...noStore })
  }
  let attachments: { name: string; type: string; dataUrl: string }[] = []
  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: 'Each image must be 1.5 MB or smaller.' }, { status: 400, ...noStore })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image attachments are supported.' }, { status: 400, ...noStore })
    }
    const bytes = Buffer.from(await file.arrayBuffer())
    attachments.push({
      name: file.name.slice(0, 160),
      type: file.type || 'application/octet-stream',
      dataUrl: `data:${file.type || 'application/octet-stream'};base64,${bytes.toString('base64')}`,
    })
  }

  try {
    const result = await addNotification({
      title,
      message,
      senderName: 'RJ FM 93.5',
      senderVerified: true,
      ...(attachments.length > 0 ? { attachments } : {}),
    })
    return NextResponse.json(result, noStore)
  } catch (error) {
    console.error('[morefm] notification send failed', error)
    return NextResponse.json({ error: 'Could not send the notification.' }, { status: 503, ...noStore })
  }
}
