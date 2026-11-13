import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getAdminStatus, queueDjMic } from '@/lib/station'
import { getSettings, SETTINGS_PATH, writeJson } from '@/lib/storage'
import type { AudioAsset } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/flac'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'mp4', 'aac', 'wav', 'ogg', 'webm', 'flac'])
const MIME_BY_EXTENSION: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm', flac: 'audio/flac' }

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Please select an audio file.' }, { status: 400 })
  const file = form.get('file')
  const kind = form.get('kind')
  const slot = Number(form.get('slot'))
  const duration = Number(form.get('duration'))
  if (!(file instanceof File) || !['jingle', 'commercial', 'golden-sunday', 'dj-mic'].includes(String(kind))) {
    return NextResponse.json({ error: 'Invalid audio upload.' }, { status: 400 })
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const reportedType = (file.type || '').split(';')[0].trim().toLowerCase()
  const normalizedReportedType = reportedType === 'audio/mp3' ? 'audio/mpeg' : reportedType
  const contentType = AUDIO_TYPES.has(normalizedReportedType) ? normalizedReportedType : MIME_BY_EXTENSION[extension] ?? normalizedReportedType
  if (!AUDIO_TYPES.has(contentType) || file.size === 0 || file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: 'Use a supported audio file under 4 MB.' }, { status: 400 })
  }
  if (!Number.isFinite(duration) || duration < 1 || duration > 900) {
    return NextResponse.json({ error: 'Audio duration must be between 1 second and 15 minutes.' }, { status: 400 })
  }
  if (kind === 'commercial' && (!Number.isInteger(slot) || slot < 0 || slot > 2)) {
    return NextResponse.json({ error: 'Choose commercial slot 1, 2, or 3.' }, { status: 400 })
  }
  const ext = extension.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'audio'
  const pathname = `station/audio/${kind}${kind === 'commercial' ? `-${slot + 1}` : ''}.${ext}`
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN ?? process.env.VERCEL_BLOB_READ_WRITE_TOKEN
  if (!blobToken && !process.env.VERCEL_OIDC_TOKEN) {
    return NextResponse.json({ error: 'Audio storage is not configured. Add BLOB_READ_WRITE_TOKEN to the project environment, then try again.' }, { status: 503 })
  }
  try {
    const blob = await put(pathname, file, { access: 'private', addRandomSuffix: true, contentType, ...(blobToken ? { token: blobToken } : {}) })
    const asset: AudioAsset = {
      url: `/api/audio/${blob.pathname.split('/').map(encodeURIComponent).join('/')}`,
      pathname: blob.pathname,
      name: file.name.slice(0, 120),
      duration,
    }
    const settings = await getSettings()
    if (kind === 'jingle') {
      settings.jingle = asset
      settings.jingleEnabled = true
    }
    else if (kind === 'commercial') settings.commercials[slot] = asset
    else if (kind === 'golden-sunday') settings.goldenSunday = asset
    else settings.djMic = asset
    await writeJson(SETTINGS_PATH, settings)
    if (kind === 'dj-mic' && settings.djMicEnabled) await queueDjMic(asset)
    return NextResponse.json({ asset, status: await getAdminStatus() })
  } catch (error) {
    console.error('[morefm] audio upload failed', error)
    const detail = error instanceof Error ? error.message.slice(0, 180) : 'Unknown storage error'
    console.error('[morefm] audio upload failed:', detail)
    return NextResponse.json({ error: `Audio upload failed: ${detail}` }, { status: 500 })
  }
}
