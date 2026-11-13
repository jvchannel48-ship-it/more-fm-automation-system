import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getAdminStatus } from '@/lib/station'
import { getSettings, SETTINGS_PATH, writeJson } from '@/lib/storage'
import type { AudioAsset } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/flac'])

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Please select an audio file.' }, { status: 400 })
  const file = form.get('file')
  const kind = form.get('kind')
  const slot = Number(form.get('slot'))
  const duration = Number(form.get('duration'))
  if (!(file instanceof File) || !['jingle', 'commercial', 'golden-sunday'].includes(String(kind))) {
    return NextResponse.json({ error: 'Invalid audio upload.' }, { status: 400 })
  }
  if (!AUDIO_TYPES.has(file.type) || file.size === 0 || file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: 'Use a supported audio file under 4 MB.' }, { status: 400 })
  }
  if (!Number.isFinite(duration) || duration < 1 || duration > 900) {
    return NextResponse.json({ error: 'Audio duration must be between 1 second and 15 minutes.' }, { status: 400 })
  }
  if (kind === 'commercial' && (!Number.isInteger(slot) || slot < 0 || slot > 2)) {
    return NextResponse.json({ error: 'Choose commercial slot 1, 2, or 3.' }, { status: 400 })
  }
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'audio'
  const pathname = `station/audio/${kind}${kind === 'commercial' ? `-${slot + 1}` : ''}.${ext}`
  try {
    const blob = await put(pathname, file, { access: 'public', addRandomSuffix: true, contentType: file.type })
    const asset: AudioAsset = { url: blob.url, name: file.name.slice(0, 120), duration }
    const settings = await getSettings()
    if (kind === 'jingle') settings.jingle = asset
    else if (kind === 'commercial') settings.commercials[slot] = asset
    else settings.goldenSunday = asset
    await writeJson(SETTINGS_PATH, settings)
    return NextResponse.json({ asset, status: await getAdminStatus() })
  } catch (error) {
    console.error('[morefm] audio upload failed', error)
    return NextResponse.json({ error: 'Audio upload failed. Check project blob storage configuration.' }, { status: 500 })
  }
}
