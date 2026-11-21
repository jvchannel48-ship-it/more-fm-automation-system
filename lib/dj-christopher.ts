import 'server-only'
import { readJson, writeJson } from './storage'

export const DJ_CHRISTOPHER_SCRIPTS_PATH = 'station/dj-christopher-scripts.json'
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
  const next = [...saved, { id, text: text.slice(0, 2200), createdAt: Date.now() }].slice(-100)
  await writeJson(DJ_CHRISTOPHER_SCRIPTS_PATH, next)
  return id
}
export async function getChristopherScript(id: string): Promise<string | null> {
  const saved = await readJson<ChristopherScript[]>(DJ_CHRISTOPHER_SCRIPTS_PATH, [])
  return saved.find((item) => item.id === id)?.text ?? null
}
