import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type RadioBrowserStation = {
  stationuuid?: string
  name?: string
  url_resolved?: string
  url?: string
  favicon?: string
  country?: string
  countrycode?: string
  tags?: string
  bitrate?: number
  codec?: string
}

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100)
  const params = new URLSearchParams({
    limit: '100',
    countrycode: 'PH',
    order: 'clickcount',
    reverse: 'true',
    hidebroken: 'true',
  })
  if (query) params.set('name', query)

  try {
    const response = await fetch(`https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`, {
      headers: { 'User-Agent': 'RJ-FM-RadioBrowser/1.0 (radio directory)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
    })
    if (!response.ok) throw new Error(`Radio Browser returned ${response.status}`)
    const raw = await response.json() as RadioBrowserStation[]
    const stations = (Array.isArray(raw) ? raw : []).flatMap((item) => {
      const stream = item.url_resolved || item.url || ''
      if (!item.stationuuid || !item.name || item.countrycode?.toUpperCase() !== 'PH' || !/^https?:\/\//i.test(stream)) return []
      return [{
        stationuuid: item.stationuuid,
        name: item.name.slice(0, 160),
        url_resolved: stream,
        favicon: item.favicon || '',
        country: 'Philippines',
        tags: item.tags || '',
        bitrate: Number.isFinite(item.bitrate) ? item.bitrate : 0,
        codec: item.codec || '',
      }]
    })
    return NextResponse.json({ stations }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[rjfm] radio browser request failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Hindi maabot ang Radio Browser ngayon. Subukan ulit mamaya.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
