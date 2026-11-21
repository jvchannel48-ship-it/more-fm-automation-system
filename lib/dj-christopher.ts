import 'server-only'
import { readJson, writeJson } from './storage'

export const DJ_CHRISTOPHER_SCRIPTS_PATH = 'station/dj-christopher-scripts.json'
export const DJ_CHRISTOPHER_TIMECHECKS_PATH = 'station/dj-christopher-timechecks.json'
export interface ChristopherTimeCheck { id: string; scriptId: string; text: string; createdAt: number; mode: 'after3' | 'dzmm'; afterSongNumber: number; scheduledAt: number | null }
export interface ChristopherScript { id: string; text: string; createdAt: number }
const openings = [
  'Hello RJ FM family, this is DJ Christopher, keeping you company with the songs you love.',
  'Good day, music lovers. Christopher here, your friendly voice on RJ FM.',
  'You are listening to RJ FM, and I am DJ Christopher. Thank you for spending part of your day with us.',
  'Hey there, RJ FM listeners. Christopher is here to bring a little extra sunshine to your radio.',
]
const features = [
  'Take a moment to relax, breathe, and enjoy the music. Whether you are working, travelling, studying, or taking a well-deserved break, we are glad to be part of your day.',
  'Keep the good memories close and share a song with someone who matters. Music has a wonderful way of connecting people, even when they are miles apart.',
  'Wherever you are listening from, at home, on the road, or at work, turn up the radio and let the music make the moment better.',
  'A big thank you to everyone listening across our RJ FM stations. Your company makes every hour on the radio special, and we appreciate you being here.',
  'Stay safe on the road, take care of one another, and keep the positive energy going. We have more great music lined up for you.',
  'If today has been busy, let this be your little reminder to slow down and enjoy the things that make you smile. You deserve a good moment.',
]
const closings = [
  'Stay right here, because more favourites are coming your way. This is DJ Christopher on RJ FM. Enjoy the music!',
  'Keep listening and keep smiling. I will leave you with more great songs, right here on RJ FM.',
  'Thank you for listening. Do not touch that dial; the music continues on RJ FM. This is Christopher, signing off for now.',
  'Share RJ FM with your friends and family, and let us enjoy the soundtrack of the day together. More music is on the way!',
]
function pick<T>(items: T[], avoid?: T) {
  const choices = items.filter((item) => item !== avoid)
  return choices[Math.floor(Math.random() * choices.length)] ?? items[0]
}
export function buildChristopherScript(request?: { title: string; artist: string }) {
  if (request) {
    return `${pick(openings)} We have a special song request from one of our listeners. They asked for ${request.title} by ${request.artist}. Thank you for sending your request and for being part of our RJ FM community. To everyone listening, we hope this song brings back a wonderful memory or makes your day a little brighter. Keep those requests and greetings coming through the station. We are happy to share the music with you. ${pick(closings)}`
  }
  return `${pick(openings)} ${pick(features)} Remember, great music is even better when shared. Send a greeting to a friend, tell your family where you are listening, and enjoy this time with us. From Manila to our regional RJ FM communities, we appreciate every listener who chooses to tune in. ${pick(features)} ${pick(closings)}`
}
export async function saveChristopherScript(text: string): Promise<string> {
  const saved = await readJson<ChristopherScript[]>(DJ_CHRISTOPHER_SCRIPTS_PATH, [])
  const id = crypto.randomUUID()
  const next = [...saved, { id, text: text.slice(0, 2200), createdAt: Date.now() }]
  await writeJson(DJ_CHRISTOPHER_SCRIPTS_PATH, next)
  return id
}
export async function getChristopherScript(id: string): Promise<string | null> {
  const saved = await readJson<ChristopherScript[]>(DJ_CHRISTOPHER_SCRIPTS_PATH, [])
  return saved.find((item) => item.id === id)?.text ?? null
}

export function buildTimeCheckScript(prompt: string) {
  const match = prompt.match(/(?:time(?:\s+check)?\s*(?:is|at)?\s*)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i)
  if (!match) throw new Error('Include a time, for example: Generate RJ FM time check is 4:30 AM.')
  const hour = Number(match[1])
  const minute = Number(match[2] ?? '00')
  if (hour < 1 || hour > 12 || minute > 59) throw new Error('Enter a valid 12-hour time, such as 4:30 AM.')
  const time = `${hour}:${String(minute).padStart(2, '0')} ${match[3].replace(/\./g, '').toUpperCase()}`
  const greeting = match[3].toLowerCase().startsWith('a') ? 'Good morning' : 'Good afternoon and good evening'
  return `${greeting}, RJ FM family. This is DJ Christopher with your official RJ FM time check. The time is ${time}. Wherever you are listening, thank you for making RJ FM part of your day. Stay tuned for more great music and good company, right here on RJ FM.`
}
export function estimateChristopherDuration(text: string) {
  return Math.max(12, Math.ceil(text.trim().split(/\\s+/).length / 2.45))
}
export async function enqueueChristopherTimeCheck(prompt: string, mode: 'after3' | 'dzmm', songCount: number) {
  const text = buildTimeCheckScript(prompt)
  const scriptId = await saveChristopherScript(text)
  const saved = await readJson<ChristopherTimeCheck[]>(DJ_CHRISTOPHER_TIMECHECKS_PATH, [])
  const pending = saved.filter((item) => item.scheduledAt === null)
  const afterSongNumber = mode === 'after3'
    ? Math.max(songCount, ...pending.filter((item) => item.mode === 'after3').map((item) => item.afterSongNumber)) + 3
    : 0
  const item: ChristopherTimeCheck = { id: crypto.randomUUID(), scriptId, text, createdAt: Date.now(), mode, afterSongNumber, scheduledAt: null }
  await writeJson(DJ_CHRISTOPHER_TIMECHECKS_PATH, [...saved, item])
  return item
}
export async function listChristopherTimeChecks() {
  return readJson<ChristopherTimeCheck[]>(DJ_CHRISTOPHER_TIMECHECKS_PATH, [])
}
export async function nextChristopherTimeCheck(mode: 'after3' | 'dzmm', songCount = 0) {
  const saved = await listChristopherTimeChecks()
  return saved.find((item) => item.mode === mode && item.scheduledAt === null && (mode === 'dzmm' || item.afterSongNumber <= songCount)) ?? null
}
export async function markChristopherTimeCheckScheduled(id: string, scheduledAt: number) {
  const saved = await listChristopherTimeChecks()
  await writeJson(DJ_CHRISTOPHER_TIMECHECKS_PATH, saved.map((item) => item.id === id ? { ...item, scheduledAt } : item))
}
