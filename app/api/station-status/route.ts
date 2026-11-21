import { NextResponse } from 'next/server'
import { STATIONS, STATION_ORDER } from '@/lib/stations'
import { getActiveStationListenerCounts, getAverageListenerCount, getStationListenerStats } from '@/lib/storage'
import { getNowPlaying } from '@/lib/station'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [metrics, active, totalAverage, nowPlaying] = await Promise.all([
    getStationListenerStats(),
    getActiveStationListenerCounts(),
    getAverageListenerCount(),
    Promise.all(STATION_ORDER.map((id) => getNowPlaying({ station: id, skipFill: true }))),
  ])
  const stations = STATION_ORDER.map((id, index) => {
    const history = metrics.filter((item) => item.station === id)
    const average = history.length
      ? Math.round(history.reduce((sum, item) => sum + item.count, 0) / history.length)
      : 0
    const latest = history.at(-1)
    return {
      id,
      name: STATIONS[id].name,
      frequency: STATIONS[id].frequency,
      listenersNow: active.stationCounts[id] ?? 0,
      currentSong: (() => {
        const now = nowPlaying[index].serverTime
        const tracks = nowPlaying[index].tracks.filter((track) => track.kind === 'music').sort((a, b) => a.startAt - b.startAt)
        const current = tracks.find((track) => track.startAt <= now && track.startAt + track.duration * 1000 > now)
        return current?.title ?? tracks.find((track) => track.startAt > now)?.title ?? 'Music rotation preparing'
      })(),
      averageListeners24h: average,
      samples24h: history.length,
      status: (active.stationCounts[id] ?? 0) > 0 ? 'LIVE' : latest && Date.now() - latest.t < 60_000 ? 'ON AIR' : 'WAITING FOR DATA',
    }
  })
  const totalNow = active.totalListenersNow
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
