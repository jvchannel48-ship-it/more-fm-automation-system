import 'server-only'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import type { CrossfaderCurve, MorSyncRecord, SongRequest, StationSettings } from './types'
import { hasSupabaseMediaConfig, readSupabaseJson, writeSupabaseJson } from './supabase-media'

// NOTE: Full file restored in next commit - this is emergency bootstrap
export const SETTINGS_PATH = 'app-state/station/settings.json'
export const SETTINGS_MIGRATIONS_PATH = 'app-state/station/settings-migrations.json'
export const STATE_PATH = 'app-state/station/state.json'
export const QUEUE_LOCK_PATH = 'app-state/station/queue.lock'
export const MOR_SYNC_PATH = 'app-state/station/mor-sync.json'
export const EMPTY_MOR_SYNC_RECORD: MorSyncRecord = { enabled: false, lastTitle: '', lastArtist: '', lastSyncedAt: 0, lastError: null }

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const data = await readSupabaseJson(path)
    return (data as T) ?? fallback
  } catch {
    return fallback
  }
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await writeSupabaseJson(path, data)
}

export async function getSettings(): Promise<StationSettings> {
  const saved = await readJson<Partial<StationSettings>>(SETTINGS_PATH, {})
  return {
    broadcastEnabled: typeof saved.broadcastEnabled === 'boolean' ? saved.broadcastEnabled : true,
    boardOperatorEnabled: false,
    noRepeatEnabled: true,
    autoDjEnabled: true,
    morSyncEnabled: typeof saved.morSyncEnabled === 'boolean' ? saved.morSyncEnabled : false,
    shuffleEnabled: true,
    goodVibesEnabled: false,
    rotationPoolSize: 100,
    listenerLimit: 0,
    tagalogOnlyEnabled: true,
    transmitterWatts: 100000,
    signOffHour: 1,
    signOnHour: 4,
    discoStartHour: 16,
    discoEndHour: 19,
    christmasEnabled: false,
    autoVoiceEnabled: false,
    autoVoiceAnnouncement: null,
    djMicEnabled: false,
    newsEnabled: true,
    nightVolumeEnabled: true,
    nightVolumeStartHour: 22,
    nightVolumeEndHour: 6,
    masterVolume: typeof saved.masterVolume === 'number' ? saved.masterVolume : 80,
    nightVolumePercent: typeof saved.nightVolumePercent === 'number' ? saved.nightVolumePercent : 70,
    bassGainDb: typeof saved.bassGainDb === 'number' ? saved.bassGainDb : 12,
    crossfaderEnabled: true,
    crossfaderCurve: 'constant-power',
    crossfadeSeconds: 8,
    replayGainEnabled: false,
    replayGainTargetLufs: -14,
    jingleEnabled: true,
    commercialEnabled: false,
    jingle: saved.jingle ?? null,
    commercials: [null, null, null],
    goldenSunday: saved.goldenSunday ?? null,
    news: null,
    djMic: null,
  } as StationSettings
}

export async function getRatings() { return {} }
export async function hasQueuePersistence() { return hasSupabaseMediaConfig() }
export async function hasSettingsPersistence() { return hasSupabaseMediaConfig() }
export async function hasPersistentStorage() { return hasSupabaseMediaConfig() }
export async function acquireStationLease(_path: string, _ms: number) { return { pathname: _path, owner: randomUUID() } }
export async function releaseStationLease(_lease: { pathname: string; owner: string }) {}
export async function renewStationLease(_lease: { pathname: string; owner: string }, _ms: number) { return true }
