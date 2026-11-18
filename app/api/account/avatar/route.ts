import { type NextRequest, NextResponse } from 'next/server'
import { privateJsonHeaders, requireAccount } from '@/lib/account-api'
import { getAvatar, saveAvatar } from '@/lib/account-store'

export const dynamic = 'force-dynamic'
export const maxDuration = 30
const MAX_AVATAR_BYTES = 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function GET(request: NextRequest) {
  const { user, response } = await requireAccount(request)
  if (response) return response
  try {
    const avatar = await getAvatar(user!.id)
    if (!avatar?.avatar_data || !avatar.avatar_mime) return new Response(null, { status: 404, headers: privateJsonHeaders })
    return new Response(new Uint8Array(avatar.avatar_data), {
      headers: {
        'Content-Type': avatar.avatar_mime,
        'Content-Length': String(avatar.avatar_data.length),
        'Cache-Control': 'private, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[morefm] avatar read failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Hindi mabasa ang profile picture.' }, { status: 503, headers: privateJsonHeaders })
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAccount(request)
  if (response) return response
  const form = await request.formData().catch(() => null)
  const file = form?.get('avatar')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Piliin muna ang profile picture.' }, { status: 400, headers: privateJsonHeaders })
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: 'JPEG, PNG, o WebP images lang ang tinatanggap.' }, { status: 415, headers: privateJsonHeaders })
  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) return NextResponse.json({ error: 'Maximum avatar size ay 1 MB.' }, { status: 413, headers: privateJsonHeaders })
  try {
    await saveAvatar(user!.id, file.type, Buffer.from(await file.arrayBuffer()))
    return NextResponse.json({ avatarUrl: `/api/account/avatar?v=${Date.now()}` }, { headers: privateJsonHeaders })
  } catch (error) {
    console.error('[morefm] avatar save failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Hindi ma-save ang profile picture. I-check ang Render Postgres migration.' }, { status: 503, headers: privateJsonHeaders })
  }
}
