const baseUrl = process.env.AUTODJ_BASE_URL?.replace(/\/$/, '')
const secret = process.env.AUTODJ_CRON_SECRET
const stations = ['main', 'naga', 'cebu', 'gensan', 'cdo', 'davao', 'iloilo', 'masbate']
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

if (!baseUrl || !secret) {
  throw new Error('Set AUTODJ_BASE_URL and AUTODJ_CRON_SECRET before starting the RJ FM AutoDJ keeper.')
}

console.log('[rjfm-autodj] 24/7 background keeper started')

while (true) {
  const cycleStartedAt = Date.now()
  for (const station of stations) {
    try {
      const response = await fetch(`${baseUrl}/api/cron/autodj?station=${station}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(55_000),
        cache: 'no-store',
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        console.error(`[rjfm-autodj] ${station} heartbeat failed (${response.status})`, result.error ?? '')
      } else {
        console.log(`[rjfm-autodj] ${station}: ${result.upcomingTracks ?? 0} upcoming music tracks`)
      }
    } catch (error) {
      console.error(`[rjfm-autodj] ${station} request failed; will retry next cycle`, error instanceof Error ? error.message : error)
    }
    await sleep(1500)
  }
  const elapsed = Date.now() - cycleStartedAt
  await sleep(Math.max(5_000, 30_000 - elapsed))
}
