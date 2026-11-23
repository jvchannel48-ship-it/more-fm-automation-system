import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SEARCH_URL = 'https://de1.api.radio-browser.info/json/stations/search?name=DZMM&countrycode=PH&hidebroken=true&limit=50'
const FALLBACK_STREAM = 'https://us1.amfmph.com:8852/live'

export async function GET() {
  try {
    const response = await fetch(SEARCH_URL, {
      headers: { 'User-Agent': 'RJ-FM/1.0 (DZMM scheduled relay)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok) {
      const stations = await response.json() as Array<{ name?: string; countrycode?: string; lastcheckok?: number; stationuuid?: string; url_resolved?: string; url?: string }>
      const match = stations.find((station) =>
        /\bdzmm\b/i.test(station.name ?? '')
        && (station.countrycode === 'PH' || !station.countrycode)
        && station.lastcheckok === 1
        && Boolean(station.stationuuid)
        && Boolean(station.url_resolved || station.url),
      )
      if (match?.stationuuid) {
        const click = await fetch(`https://de1.api.radio-browser.info/json/url/${encodeURIComponent(match.stationuuid)}`, {
          headers: { 'User-Agent': 'RJ-FM/1.0 (DZMM scheduled relay)' },
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        })
        if (click.ok) {
          const resolved = await click.json() as { url?: string }
          if (resolved.url && /^https?:\/\//i.test(resolved.url)) {
            return NextResponse.json({ name: match.name ?? 'DZMM', url: resolved.url, source: 'radio-browser' }, { headers: { 'Cache-Control': 'no-store' } })
          }
        }
        const url = match.url_resolved || match.url
        if (url && /^https?:\/\//i.test(url)) {
          return NextResponse.json({ name: match.name ?? 'DZMM', url, source: 'radio-browser' }, { headers: { 'Cache-Control': 'no-store' } })
        }
      }
    }
  } catch (error) {
    console.warn('[RJ FM] Radio Browser DZMM lookup failed; using configured fallback.', error)
  }
  return NextResponse.json({ name: 'DZMM', url: FALLBACK_STREAM, source: 'fallback' }, { headers: { 'Cache-Control': 'no-store' } })
}
