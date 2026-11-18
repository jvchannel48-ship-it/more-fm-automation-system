import { randomUUID } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { privateJsonHeaders, requireAccount } from '@/lib/account-api'

export const dynamic = 'force-dynamic'
export const maxDuration = 30
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export async function POST(request: NextRequest) {
  const { user, client, response } = await requireAccount(request.headers.get('authorization'))
  if (response) return response
  const form = await request.formData().catch(() => null)
  const file = form?.get('avatar')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Piliin muna ang profile picture.' }, { status: 400, headers: privateJsonHeaders })
  const ext = MIME_EXT[file.type]
  if (!ext) return NextResponse.json({ error: 'JPEG, PNG, o WebP images lang ang tinatanggap.' }, { status: 415, headers: privateJsonHeaders })
  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) return NextResponse.json({ error: 'Maximum avatar size ay 2 MB.' }, { status: 413, headers: privateJsonHeaders })
  const { data: oldProfile } = await client!.from('listener_profiles').select('avatar_url').eq('user_id', user!.id).maybeSingle()
  const path = `${user!.id}/${randomUUID()}.${ext}`
  const { error: uploadError } = await client!.storage.from('listener-avatars').upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false })
  if (uploadError) return NextResponse.json({ error: 'Hindi na-upload ang larawan. I-check ang listener-avatars Supabase bucket.' }, { status: 503, headers: privateJsonHeaders })
  const { data } = client!.storage.from('listener-avatars').getPublicUrl(path)
  const { error: updateError } = await client!.from('listener_profiles').upsert({ user_id: user!.id, avatar_url: data.publicUrl, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (updateError) {
    await client!.storage.from('listener-avatars').remove([path])
    return NextResponse.json({ error: 'Na-upload ang file pero hindi na-save ang profile. I-apply ang Supabase migration.' }, { status: 503, headers: privateJsonHeaders })
  }
  const oldUrl = oldProfile?.avatar_url
  const marker = '/storage/v1/object/public/listener-avatars/'
  if (typeof oldUrl === 'string' && oldUrl.includes(marker)) {
    const oldPath = decodeURIComponent(oldUrl.split(marker)[1].split('?')[0])
    if (oldPath.startsWith(`${user!.id}/`) && oldPath !== path) await client!.storage.from('listener-avatars').remove([oldPath])
  }
  return NextResponse.json({ avatarUrl: data.publicUrl }, { headers: privateJsonHeaders })
}
