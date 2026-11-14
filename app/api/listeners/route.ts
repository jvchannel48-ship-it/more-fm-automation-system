import { NextRequest, NextResponse } from 'next/server'
import { updateListener } from '@/lib/listeners'
import { getSettings } from '@/lib/storage'

export const dynamic = 'force-dynamic'

function geoHeader(request: NextRequest, ...names: string[]) {
  for (const name of names) {
    const raw = request.headers.get(name)
    if (!raw) continue
    let value = raw.trim()
    try { value = decodeURIComponent(value.replace(/\+/g, '%20')) } catch { /* Keep the sanitized raw header. */ }
    const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
    if (cleaned) return cleaned
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown; active?: unknown }
    if (typeof body.id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.id) || typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'Invalid listener heartbeat' }, { status: 400 })
    }
    const settings = await getSettings()
    const rawCountry = geoHeader(request, 'x-vercel-ip-country', 'cf-ipcountry')?.toUpperCase() ?? null
    const location = {
      city: geoHeader(request, 'x-vercel-ip-city'),
      region: geoHeader(request, 'x-vercel-ip-country-region'),
      countryCode: rawCountry && /^[A-Z]{2}$/.test(rawCountry) && rawCountry !== 'XX' ? rawCountry : null,
    }
    const result = await updateListener(body.id, body.active, settings.listenerLimit, location)
    return NextResponse.json({
      accepted: result.accepted,
      listenersNow: result.listenersNow,
      listenerLimit: settings.listenerLimit,
      message: result.accepted ? undefined : 'THIS STATION IS LIMITED LISTENER. Please try again later.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] listener heartbeat failed', error)
    return NextResponse.json({ error: 'Could not check station listener capacity.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
