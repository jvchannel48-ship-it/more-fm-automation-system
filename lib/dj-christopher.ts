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
export function buildChristopherScript(request?: { title: string; artist: string; location?: string }) {
  if (request) {
    const location = request.location?.trim() || 'our wonderful RJ FM listening community'
    const requestOpenings = [
      'We have a lovely request coming in, and it is always a pleasure to hear from you.',
      'Now, let us make this next musical moment extra special with a listener request.',
      'A little radio love is heading your way because one of our listeners has chosen the next song.',
      'It is time to share another song picked by someone listening right along with us.',
      'Here is a special musical dedication from one of the voices in our RJ FM family.',
    ]
    const thankYous = [
      'Thank you so much for taking the time to send your request and for making RJ FM part of your day.',
      'We truly appreciate your message, your song choice, and your continued support of our station.',
      'Thanks for listening, for reaching out, and for sharing the music you love with our whole radio family.',
      'Your request means a lot to us. Thank you for being part of this growing community of music lovers.',
    ]
    const shoutouts = [
      `A warm and cheerful hello to everyone listening from ${location}!`,
      `Sending a big RJ FM shout-out to you and everyone tuning in from ${location}.`,
      `Special greetings are on the way to our listener in ${location}, and to all your friends and family listening nearby.`,
      `Wherever you are in ${location}, we hope this moment brings a smile to your day.`,
    ]
    const bridges = [
      'Whether you are at home, at work, travelling, or taking a quiet break, we are glad you chose to spend this time with us.',
      'We hope the melody brings back a beautiful memory, gives you a little energy, or simply makes the day feel brighter.',
      'Keep enjoying the moment, share the good vibes with someone special, and remember that great music brings us closer.',
      'Turn up the volume if you can, get comfortable, and let this song be the soundtrack to your next few minutes.',
    ]
    const leadIns = [
      'And now, coming up next, especially for you:',
      'All right, your requested song is coming up next:',
      'Get ready, because we are about to play your selection:',
      'Here it comes, your special request:',
    ]
    return `${pick(openings)} ${pick(requestOpenings)} ${pick(shoutouts)} ${pick(thankYous)} You requested ${request.title} by ${request.artist}. ${pick(bridges)} ${pick(leadIns)} ${request.title} by ${request.artist}. Stay tuned and wait for your requested song right here on RJ FM. Keep your messages and song requests coming; we would love to hear from you again. This is DJ Christopher, keeping you company with more great music. ${pick(closings)}`
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
  const match = prompt.match(/(?:time(?:\s+check)?\s*(?:is|at)?\s*)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i)
  if (!match) throw new Error('Include a time, for example: RJ FM time check is 9:30.')
  const hour = Number(match[1])
  const minute = Number(match[2] ?? '00')
  if (hour < 1 || hour > 12 || minute > 59) throw new Error('Enter a valid time, such as 9:30.')
  const time = `${hour}:${String(minute).padStart(2, '0')}`
  return `RJ FM time check is ${time}.`
}
export function estimateChristopherDuration(text: string) {
  return Math.max(10, Math.ceil(text.trim().split(/\s+/).length / 2.8))
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
  if (mode === 'dzmm' && saved.some((item) => item.mode === 'dzmm' && item.scheduledAt !== null && Math.abs(Date.now() - item.scheduledAt) < 24 * 60 * 60 * 1000)) return null
  return saved.find((item) => item.mode === mode && item.scheduledAt === null && (mode === 'dzmm' || item.afterSongNumber <= songCount)) ?? null
}
export async function markChristopherTimeCheckScheduled(id: string, scheduledAt: number) {
  const saved = await listChristopherTimeChecks()
  await writeJson(DJ_CHRISTOPHER_TIMECHECKS_PATH, saved.map((item) => item.id === id ? { ...item, scheduledAt } : item))
}
