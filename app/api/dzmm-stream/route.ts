import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SEARCH_URL = 'https://de1.api.radio-browser.info/json/stations/search?name=DZMM&countrycode=PH&hidebroken=true&limit=50'
const FALLBACK_STREAM = 'https://us1.amfmph.com:8852/live'

type RadioBrowserStation = {
  name?: string
  countrycode?: string
  lastcheckok?: number
  stationuuid?: string
  url_resolved?: string
  url?: string
}

export async function GET() {
  try {
    const response = await fetch(SEARCH_URL, {
      headers: { 'User-Agent': 'RJ-FM/1.0 (DZMM scheduled relay)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    })
    if (response.ok) {
      const stations = await response.json() as RadioBrowserStation[]
      // Use the first six healthy DZMM/TeleRadyo matches as ordered candidates.
      const candidates = stations
        .filter((station) =>
          /dzmm|teleradyo/i.test(station.name ?? '')
          && (station.countrycode === 'PH' || !station.countrycode)
          && station.lastcheckok === 1
          && Boolean(station.stationuuid)
          && Boolean(station.url_resolved || station.url),
        )
        .slice(0, 6)

      for (const station of candidates) {
        try {
          const click = await fetch(`https://de1.api.radio-browser.info/json/url/${encodeURIComponent(station.stationuuid!)}`, {
            headers: { 'User-Agent': 'RJ-FM/1.0 (DZMM scheduled relay)' },
            cache: 'no-store',
            signal: AbortSignal.timeout(4000),
          })
          if (click.ok) {
            const resolved = await click.json() as { url?: string }
            if (resolved.url && /^https?:\/\//i.test(resolved.url)) {
              return NextResponse.json({ name: 'DZMM TeleRadyo', url: resolved.url, source: 'radio-browser', candidatesTried: candidates.indexOf(station) + 1 }, { headers: { 'Cache-Control': 'no-store' } })
            }
          }
        } catch {
          // Try the next of the six Radio Browser results.
        }
        const url = station.url_resolved || station.url
        if (url && /^https?:\/\//i.test(url)) {
          return NextResponse.json({ name: 'DZMM TeleRadyo', url, source: 'radio-browser', candidatesTried: candidates.indexOf(station) + 1 }, { headers: { 'Cache-Control': 'no-store' } })
        }
      }
    }
  } catch (error) {
    console.warn('[RJ FM] Radio Browser DZMM lookup failed; using configured fallback.', error)
  }
  return NextResponse.json({ name: 'DZMM TeleRadyo', url: FALLBACK_STREAM, source: 'fallback' }, { headers: { 'Cache-Control': 'no-store' } })
}
