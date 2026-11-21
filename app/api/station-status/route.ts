import { NextResponse } from 'next/server'
import { STATIONS, STATION_ORDER } from '@/lib/stations'
import { getStationListenerStats } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  const metrics = await getStationListenerStats()
  const stations = STATION_ORDER.map((id) => {
    const history = metrics.filter((item) => item.station === id)
    const average = history.length
      ? Math.round(history.reduce((sum, item) => sum + item.count, 0) / history.length)
      : 0
    const latest = history.at(-1)
    return {
      id,
      name: STATIONS[id].name,
      frequency: STATIONS[id].frequency,
      listenersNow: latest && Date.now() - latest.t < 60_000 ? latest.count : 0,
      averageListeners24h: average,
      samples24h: history.length,
      status: latest && Date.now() - latest.t < 60_000 ? 'LIVE' : 'WAITING FOR DATA',
    }
  })
  const totalNow = stations.reduce((sum, station) => sum + station.listenersNow, 0)
  const totalAverage = stations.reduce((sum, station) => sum + station.averageListeners24h, 0)
  const ranked = [...stations].sort((a, b) => b.averageListeners24h - a.averageListeners24h || a.name.localeCompare(b.name))
  const rankedStations = stations.map((station) => ({
    ...station,
    rjfmRank: ranked.findIndex((item) => item.id === station.id) + 1,
  }))
  return NextResponse.json({
    updatedAt: Date.now(),
    totalListenersNow: totalNow,
    totalAverageListeners24h: totalAverage,
    rankingScope: 'RJ FM network only · ranked by measured 24-hour average listeners',
    stations: rankedStations,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
