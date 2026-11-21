import { NextResponse } from 'next/server'
import { STATIONS, STATION_ORDER } from '@/lib/stations'
import { getActiveStationListenerCounts, getStationListenerStats } from '@/lib/storage'
import { getStationNowPlayingTitle } from '@/lib/station'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [metrics, active, nowPlaying] = await Promise.all([
    getStationListenerStats(),
    getActiveStationListenerCounts(),
    Promise.all(STATION_ORDER.map((id) => getStationNowPlayingTitle(id))),
  ])
  const windowMs = 24 * 60 * 60 * 1000
  const sampleHoldMs = 60_000
  const windowStart = Date.now() - windowMs
  const weightedAverage = (station: string) => {
    const history = metrics.filter((item) => item.station === station && item.t >= windowStart).sort((a, b) => a.t - b.t)
    let listenerMilliseconds = 0
    for (let index = 0; index < history.length; index++) {
      const sample = history[index]
      const nextTime = history[index + 1]?.t ?? Date.now()
      const end = Math.min(nextTime, sample.t + sampleHoldMs, Date.now())
      listenerMilliseconds += sample.count * Math.max(0, end - Math.max(sample.t, windowStart))
    }
    return Math.round(listenerMilliseconds / windowMs * 10) / 10
  }
  const stations = STATION_ORDER.map((id, index) => {
    const history = metrics.filter((item) => item.station === id)
    const average = weightedAverage(id)
    const latest = history.at(-1)
    return {
      id,
      name: STATIONS[id].name,
      frequency: STATIONS[id].frequency,
      listenersNow: active.stationCounts[id] ?? 0,
      currentSong: nowPlaying[index],
      averageListeners24h: average,
      samples24h: history.length,
      status: (active.stationCounts[id] ?? 0) > 0 ? 'LIVE' : latest && Date.now() - latest.t < 60_000 ? 'ON AIR' : 'WAITING FOR DATA',
    }
  })
  const totalNow = active.totalListenersNow
  const ranked = [...stations].filter((station) => station.samples24h > 0).sort((a, b) => b.averageListeners24h - a.averageListeners24h || a.name.localeCompare(b.name))
  const rankedStations = stations.map((station) => ({ ...station, rjfmRank: station.samples24h > 0 ? ranked.findIndex((item) => item.id === station.id) + 1 : 0 }))
  const networkAverage = Math.round(stations.reduce((sum, station) => sum + station.averageListeners24h, 0) * 10) / 10
  return NextResponse.json({
    updatedAt: Date.now(),
    totalListenersNow: totalNow,
    totalAverageListeners24h: networkAverage,
    rankingScope: 'RJ FM network only · ranked by measured 24-hour average listeners',
    stations: rankedStations,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
