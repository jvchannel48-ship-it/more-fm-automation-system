'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

type UpdateInfo = { version: string; minVersion: string; apkUrl: string; whatsNew: string[] }

function compareVersions(a: string, b: string) {
  const left = a.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const right = b.split('.').map((part) => Number.parseInt(part, 10) || 0)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0)
    if (difference) return difference
  }
  return 0
}

export function AppUpdateGate() {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [installedVersion, setInstalledVersion] = useState('0.0.0')
  const [mode, setMode] = useState<'checking' | 'blocked' | 'whats-new' | 'ready'>('checking')

  useEffect(() => {
    let active = true
    const check = async () => {
      try {
        if (!Capacitor.isNativePlatform()) { if (active) setMode('ready'); return }
        const [appInfo, response] = await Promise.all([
          App.getInfo(),
          fetch('/app-update.json', { cache: 'no-store' }),
        ])
        if (!response.ok) throw new Error('Hindi ma-check ang app version.')
        const latest = await response.json() as UpdateInfo
        if (!active) return
        setInfo(latest)
        setInstalledVersion(appInfo.version)
        if (compareVersions(appInfo.version, latest.minVersion) < 0) {
          setMode('blocked')
          return
        }
        const seen = window.localStorage.getItem('rjfm-whats-new-version')
        if (compareVersions(appInfo.version, latest.version) >= 0 && seen !== appInfo.version) setMode('whats-new')
        else setMode('ready')
      } catch (error) {
        console.warn('[RJ FM] App update check failed', error)
        // Do not lock out listeners during a temporary network/server outage.
        if (active) setMode('ready')
      }
    }
    void check()
    return () => { active = false }
  }, [])

  const exitApp = () => { void App.exitApp().catch(() => window.close()) }
  const finishWhatsNew = () => {
    if (info) window.localStorage.setItem('rjfm-whats-new-version', installedVersion)
    setMode('ready')
  }
  const installUpdate = () => {
    if (info) window.location.href = info.apkUrl
  }

  if (mode === 'ready' || mode === 'checking') return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050914] p-5 text-white" role="dialog" aria-modal="true" aria-labelledby="app-update-title">
      <section className="w-full max-w-md rounded-3xl border border-cyan-400/30 bg-slate-950 p-6 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300">RJ FM • Android</p>
        {mode === 'blocked' ? <>
          <h1 id="app-update-title" className="mt-3 text-2xl font-bold">Kailangan ng App Update</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">May bagong required version ({info?.minVersion}). Hindi muna bubuksan ang RJ FM hangga’t hindi nai-install ang update.</p>
          <button type="button" onClick={installUpdate} className="mt-6 w-full rounded-xl bg-cyan-400 px-4 py-3 font-bold text-slate-950">Update RJ FM</button>
          <button type="button" onClick={exitApp} className="mt-3 w-full rounded-xl border border-slate-700 px-4 py-3 font-semibold">Exit</button>
          <p className="mt-3 text-center text-xs text-slate-500">Installed version: {installedVersion}</p>
        </> : <>
          <h1 id="app-update-title" className="mt-3 text-2xl font-bold">What’s New?</h1>
          <p className="mt-1 text-sm text-slate-400">RJ FM version {info?.version}</p>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-6 text-slate-200">{(info?.whatsNew ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
          <button type="button" onClick={finishWhatsNew} className="mt-6 w-full rounded-xl bg-cyan-400 px-4 py-3 font-bold text-slate-950">Continue</button>
          <button type="button" onClick={exitApp} className="mt-3 w-full rounded-xl border border-slate-700 px-4 py-3 font-semibold">Exit</button>
        </>}
      </section>
    </div>
  )
}
