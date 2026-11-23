'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, CalendarDays, Clock3, Headphones, RotateCcw, X, Wifi, Signal, Download, Upload, Zap, Play, RefreshCw, Gauge } from 'lucide-react'

type UsageData = { totalBytes: number; totalSeconds: number; days: Record<string, number> }
type SpeedResult = { download: number | null; upload: number | null; ping: number | null; jitter: number | null; downLatency: number | null; upLatency: number | null; testedAt: string; network: string }
type SpeedEngine = {
  play: () => void
  pause: () => void
  onRunningChange: ((running: boolean) => void) | null
  onResultsChange: ((info: { type: string }) => void) | null
  onFinish: ((results: any) => void) | null
  onError: ((error: string) => void) | null
}
const KEY = 'rjfm_data_usage_v1'
const SPEED_KEY = 'rjfm_speed_test_v1'
const empty: UsageData = { totalBytes: 0, totalSeconds: 0, days: {} }

function readUsage(): UsageData {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (value && typeof value.totalBytes === 'number' && typeof value.totalSeconds === 'number') return { ...empty, ...value }
  } catch {}
  return empty
}
function fmt(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(2) + ' MB'
  return (bytes / 1024 ** 3).toFixed(2) + ' GB'
}
function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? hours + 'h ' + minutes + 'm' : minutes + 'm'
}
function localDay(date: Date) {
  return date.toLocaleDateString('en-CA')
}
function mbps(bps: number | null) {
  return bps == null || !Number.isFinite(bps) || bps <= 0 ? '—' : (bps / 1_000_000).toFixed(1)
}
function ms(value: number | null) {
  return value == null || !Number.isFinite(value) || value < 0 ? '—' : Math.round(value).toString()
}
function networkLabel() {
  const connection = (navigator as Navigator & { connection?: { type?: string; effectiveType?: string } }).connection
  if (connection?.type === 'wifi') return 'Wi-Fi'
  if (connection?.type === 'cellular') return 'Mobile data'
  if (connection?.effectiveType) return connection.effectiveType.toUpperCase() + ' connection'
  return 'Network type not exposed by browser'
}
function readSavedSpeed(): SpeedResult | null {
  try {
    const value = JSON.parse(localStorage.getItem(SPEED_KEY) || 'null')
    if (value && typeof value.testedAt === 'string') return value
  } catch {}
  return null
}

export function UsageDashboard() {
  const [usage, setUsage] = useState<UsageData>(empty)
  const [resetOpen, setResetOpen] = useState(false)
  const [speedStatus, setSpeedStatus] = useState<'ready' | 'running' | 'done' | 'error'>('ready')
  const [speedPhase, setSpeedPhase] = useState('Ready to test your connection')
  const [speedError, setSpeedError] = useState('')
  const [speedResult, setSpeedResult] = useState<SpeedResult | null>(null)
  const [networkName, setNetworkName] = useState('Checking connection…')
  const engineRef = useRef<SpeedEngine | null>(null)

  useEffect(() => {
    const refresh = () => setUsage(readUsage())
    refresh()
    setSpeedResult(readSavedSpeed())
    setNetworkName(networkLabel())
    window.addEventListener('rjfm:usage-update', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('rjfm:usage-update', refresh)
      window.removeEventListener('storage', refresh)
      engineRef.current?.pause()
      engineRef.current = null
    }
  }, [])

  const today = localDay(new Date())
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = localDay(date)
    return { key, label: date.toLocaleDateString('en', { weekday: 'short' }), bytes: usage.days[key] || 0 }
  }), [usage.days])
  const maxDay = Math.max(1, ...week.map((day) => day.bytes))
  const todayBytes = usage.days[today] || 0

  const reset = () => {
    try { localStorage.removeItem(KEY) } catch {}
    setUsage(empty)
    setResetOpen(false)
  }

  const startSpeedTest = async () => {
    if (speedStatus === 'running') {
      engineRef.current?.pause()
      engineRef.current = null
      setSpeedStatus('ready')
      setSpeedPhase('Test paused')
      return
    }
    setSpeedStatus('running')
    setSpeedError('')
    setSpeedResult(null)
    setSpeedPhase('Preparing secure test…')
    setNetworkName(networkLabel())
    try {
      const { default: SpeedTest } = await import('@cloudflare/speedtest')
      const engine = new SpeedTest({
        autoStart: false,
        measureDownloadLoadedLatency: true,
        measureUploadLoadedLatency: true,
        measurements: [
          { type: 'latency', numPackets: 10 },
          { type: 'download', bytes: 100000, count: 3, bypassMinDuration: true },
          { type: 'download', bytes: 1000000, count: 3 },
          { type: 'download', bytes: 5000000, count: 1 },
          { type: 'upload', bytes: 100000, count: 3, bypassMinDuration: true },
          { type: 'upload', bytes: 1000000, count: 3 },
          { type: 'upload', bytes: 5000000, count: 1 },
        ],
      }) as unknown as SpeedEngine
      engineRef.current = engine
      engine.onRunningChange = (running) => {
        if (running) setSpeedPhase('Measuring your real connection…')
      }
      engine.onResultsChange = (info) => {
        const labels: Record<string, string> = {
          latency: 'Measuring ping and jitter…',
          download: 'Testing download speed…',
          upload: 'Testing upload speed…',
        }
        setSpeedPhase(labels[info.type] || 'Measuring connection quality…')
      }
      engine.onError = (error) => {
        engineRef.current = null
        setSpeedStatus('error')
        setSpeedError(String(error || 'The speed test could not finish. Please try again.'))
        setSpeedPhase('Test failed')
      }
      engine.onFinish = (results) => {
        const safe = (fn: () => number) => {
          try { const value = fn(); return Number.isFinite(value) && value >= 0 ? value : null } catch { return null }
        }
        const result: SpeedResult = {
          download: safe(() => results.getDownloadBandwidth()),
          upload: safe(() => results.getUploadBandwidth()),
          ping: safe(() => results.getUnloadedLatency()),
          jitter: safe(() => results.getUnloadedJitter()),
          downLatency: safe(() => results.getDownLoadedLatency()),
          upLatency: safe(() => results.getUpLoadedLatency()),
          testedAt: new Date().toISOString(),
          network: networkLabel(),
        }
        setSpeedResult(result)
        try { localStorage.setItem(SPEED_KEY, JSON.stringify(result)) } catch {}
        setSpeedStatus('done')
        setSpeedPhase('Test complete')
        engineRef.current = null
      }
      engine.play()
    } catch (error) {
      engineRef.current = null
      setSpeedStatus('error')
      setSpeedPhase('Unable to start speed test')
      setSpeedError(error instanceof Error ? error.message : 'Unable to load the speed test engine.')
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 pb-32 pt-4">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[linear-gradient(145deg,#102c45_0%,#101c32_52%,#211632_100%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,.38)] sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-200"><Activity className="size-6" /></span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.28em] text-cyan-200">RJ FM · DEVICE STATS</p>
              <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Data Usage & Network</h1>
              <p className="text-xs text-slate-300">Your listening stats and connection speed</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200"><span className="size-1.5 rounded-full bg-emerald-300" /> On this phone</span>
        </div>

        <div className="relative mt-6 rounded-3xl border border-cyan-200/15 bg-[#061321]/65 p-5 shadow-inner">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-300">TOTAL DATA USED</p>
            <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold text-cyan-200">LISTENING ESTIMATE</span>
          </div>
          <p className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">{fmt(usage.totalBytes)}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400"><Headphones className="size-4 text-cyan-300" /> RJ FM listening estimate</div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" style={{ width: usage.totalBytes ? '100%' : '0%' }} /></div>
        </div>

        <div className="relative mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[.055] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-300"><CalendarDays className="size-4 text-cyan-200" /> Today</div>
            <p className="mt-2 text-2xl font-extrabold text-white">{fmt(todayBytes)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.055] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-300"><Clock3 className="size-4 text-violet-200" /> Listening time</div>
            <p className="mt-2 text-2xl font-extrabold text-white">{duration(usage.totalSeconds)}</p>
          </div>
        </div>

        <div className="relative mt-5 rounded-2xl border border-white/10 bg-[#071321]/65 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="text-sm font-bold text-white">Last 7 days</h2><p className="mt-0.5 text-[11px] text-slate-400">Daily listening data</p></div>
            <span className="text-[10px] font-semibold text-cyan-200">MB / KB</span>
          </div>
          <div className="flex h-28 items-end justify-between gap-2">
            {week.map((day) => <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div className="flex h-[78px] w-full items-end justify-center rounded-lg bg-white/[.035] p-1">
                <div className="w-full max-w-7 rounded-md bg-gradient-to-t from-blue-600 to-cyan-300 shadow-[0_0_14px_rgba(34,211,238,.18)]" style={{ height: day.bytes ? Math.max(7, day.bytes / maxDay * 100) + '%' : '3px', opacity: day.bytes ? 1 : .2 }} />
              </div>
              <span className="text-[10px] font-medium text-slate-400">{day.label}</span>
            </div>)}
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-end border-t border-white/10 pt-4">
          <button type="button" onClick={() => setResetOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[.04] px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"><RotateCcw className="size-3.5" /> Reset stats</button>
        </div>
      </section>

      <section className="relative mt-4 overflow-hidden rounded-[2rem] border border-cyan-300/25 bg-[radial-gradient(circle_at_90%_0%,rgba(34,211,238,.16),transparent_38%),linear-gradient(145deg,#0b253b_0%,#101b30_58%,#171b35_100%)] p-5 shadow-[0_24px_65px_rgba(0,0,0,.36)] sm:p-6">
        <div className="pointer-events-none absolute -right-14 -top-16 size-56 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-200"><Gauge className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[.25em] text-cyan-200">NETWORK PERFORMANCE</p>
            <h2 className="text-lg font-black tracking-tight text-white">Internet Speed Test</h2>
            <p className="truncate text-[11px] text-slate-400">{networkName}</p>
          </div>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-bold tracking-wider text-emerald-200">LIVE TEST</span>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-cyan-200/15 bg-[#061321]/75 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-300"><Download className="size-4 text-cyan-300" /> Download</div>
            <p className="mt-2 text-3xl font-black text-white">{mbps(speedResult?.download ?? null)} <span className="text-xs font-bold text-slate-400">Mbps</span></p>
          </div>
          <div className="rounded-2xl border border-violet-200/15 bg-[#061321]/75 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-300"><Upload className="size-4 text-violet-300" /> Upload</div>
            <p className="mt-2 text-3xl font-black text-white">{mbps(speedResult?.upload ?? null)} <span className="text-xs font-bold text-slate-400">Mbps</span></p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.045] p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400"><Zap className="size-3.5 text-amber-300" /> Ping</div>
            <p className="mt-1 text-xl font-extrabold text-white">{ms(speedResult?.ping ?? null)} <span className="text-[10px] text-slate-400">ms</span></p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.045] p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400"><Activity className="size-3.5 text-emerald-300" /> Jitter</div>
            <p className="mt-1 text-xl font-extrabold text-white">{ms(speedResult?.jitter ?? null)} <span className="text-[10px] text-slate-400">ms</span></p>
          </div>
        </div>

        <div className="relative mt-3 grid grid-cols-2 gap-3 text-[10px] text-slate-400">
          <div className="rounded-xl bg-white/[.035] px-3 py-2">Download latency <strong className="ml-1 text-slate-200">{ms(speedResult?.downLatency ?? null)} ms</strong></div>
          <div className="rounded-xl bg-white/[.035] px-3 py-2">Upload latency <strong className="ml-1 text-slate-200">{ms(speedResult?.upLatency ?? null)} ms</strong></div>
        </div>

        <div className="relative mt-4 rounded-2xl border border-white/10 bg-[#061321]/65 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-200"><span className={`size-2 rounded-full ${speedStatus === 'running' ? 'animate-pulse bg-amber-300' : speedStatus === 'done' ? 'bg-emerald-300' : speedStatus === 'error' ? 'bg-rose-400' : 'bg-slate-500'}`} />{speedPhase}</div>
            {speedStatus === 'done' && <span className="shrink-0 text-[9px] text-slate-500">{speedResult ? new Date(speedResult.testedAt).toLocaleTimeString() : ''}</span>}
          </div>
          {speedStatus === 'running' && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" /></div>}
          {speedError && <p className="mt-2 break-words text-[11px] text-rose-300">{speedError}</p>}
          <button type="button" onClick={startSpeedTest} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 text-sm font-extrabold text-slate-950 shadow-lg shadow-cyan-950/30 transition active:scale-[.99]">
            {speedStatus === 'running' ? <><X className="size-4" /> Stop test</> : speedResult ? <><RefreshCw className="size-4" /> Test again</> : <><Play className="size-4" /> Start speed test</>}
          </button>
        </div>
        <p className="relative mt-3 text-[10px] leading-relaxed text-slate-400"></p>
      </section>

      {resetOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setResetOpen(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="reset-title" className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#171d2a] p-5 shadow-2xl">
          <div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl bg-rose-400/10 text-rose-200"><RotateCcw className="size-5" /></span><button type="button" aria-label="Close" onClick={() => setResetOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X className="size-5" /></button></div>
          <h2 id="reset-title" className="mt-4 text-lg font-extrabold text-white">Reset usage stats?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">This will permanently delete the listening totals saved on this phone.</p>
          <div className="mt-6 grid grid-cols-2 gap-2"><button type="button" onClick={() => setResetOpen(false)} className="min-h-11 rounded-xl border border-white/15 text-sm font-bold text-slate-200">Cancel</button><button type="button" onClick={reset} className="min-h-11 rounded-xl bg-rose-500 text-sm font-extrabold text-white">Reset</button></div>
        </section>
      </div>}
    </main>
  )
}
