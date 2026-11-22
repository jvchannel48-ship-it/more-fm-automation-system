'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

export function NativeWelcomeSplash() {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    setVisible(true)
    let value = 0
    const started = Date.now()
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started
      value = Math.min(100, Math.round((elapsed / 2600) * 100))
      setProgress(value)
      if (value >= 100) {
        window.clearInterval(timer)
        window.setTimeout(() => setVisible(false), 180)
      }
    }, 35)
    return () => window.clearInterval(timer)
  }, [])

  if (!visible) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-[#050b1b] px-7 text-center text-white" role="status" aria-live="polite">
      <div className="absolute -left-24 top-1/4 size-72 rounded-full bg-cyan-500/20 blur-[90px]" />
      <div className="absolute -right-24 bottom-1/4 size-72 rounded-full bg-blue-600/25 blur-[90px]" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mx-auto mb-7 flex size-28 items-center justify-center rounded-[2rem] border border-cyan-300/40 bg-gradient-to-br from-cyan-300 via-blue-500 to-indigo-700 text-4xl font-black tracking-tight shadow-[0_0_55px_rgba(34,211,238,.28)]">RJ<span className="text-white">FM</span></div>
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">93.5 · Live Radio</p>
        <h1 className="mt-4 text-3xl font-black leading-tight">WELCOME TO RJ FM</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">LISTENING TO YOUR FAVORITE MUSIC TOGETHER</p>
        <div className="mt-10 h-2 overflow-hidden rounded-full border border-white/10 bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500 shadow-[0_0_18px_rgba(34,211,238,.7)] transition-[width] duration-100" style={{ width: progress + '%' }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold tracking-widest text-slate-400"><span>LOADING YOUR RADIO</span><span>{progress}%</span></div>
      </div>
    </div>
  )
}
