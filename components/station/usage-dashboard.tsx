'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, Clock3, Headphones, RotateCcw, X } from 'lucide-react'

type UsageData = { totalBytes: number; totalSeconds: number; days: Record<string, number> }
const KEY = 'rjfm_data_usage_v1'
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

export function UsageDashboard() {
  const [usage, setUsage] = useState<UsageData>(empty)
  const [resetOpen, setResetOpen] = useState(false)

  useEffect(() => {
    const refresh = () => setUsage(readUsage())
    refresh()
    window.addEventListener('rjfm:usage-update', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('rjfm:usage-update', refresh)
      window.removeEventListener('storage', refresh)
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

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 pb-32 pt-4">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[linear-gradient(145deg,#102c45_0%,#101c32_52%,#211632_100%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,.38)] sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-200"><Activity className="size-6" /></span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.28em] text-cyan-200">RJ FM · DEVICE STATS</p>
              <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Data Usage</h1>
              <p className="text-xs text-slate-300">Your listening activity</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200"><span className="size-1.5 rounded-full bg-emerald-300" /> On this phone</span>
        </div>

        <div className="relative mt-6 rounded-3xl border border-cyan-200/15 bg-[#061321]/65 p-5 shadow-inner">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-300">TOTAL DATA USED</p>
            <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold text-cyan-200">32 KBPS TARGET</span>
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
