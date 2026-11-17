import 'server-only'
import { UniversalEdgeTTS } from 'edge-tts-universal'

export const EDGE_TTS_VOICE = 'en-US-ChristopherNeural'
export const EDGE_TTS_DURATION_SECONDS = 56

const genericAnnouncement = [
  'Hello, hello, Bicol and the whole Philippines! This is RJ FM, the number one radio station in the Bicol Region, bringing you music, memories, and good company from Naga City to Camarines Sur, Albay, Sorsogon, Catanduanes, Masbate, and every Filipino listener around the country.',
  'Thank you for staying with us today. Whether you are at home, on the road, at work, or relaxing with family, keep your radio right here with RJ FM. We are keeping the music flowing with classic favorites, Tagalog love songs, English love songs, and songs that bring back beautiful memories.',
  'This is your friendly RJ FM DJ reminding you to share the music with someone special, keep safe, and enjoy the next part of our program. We appreciate every listener in the Philippines and every kababayan tuned in from anywhere in the world. Now, let me play the next song for you, right here on RJ FM.',
].join(' ')

export function buildGenericDjText() {
  return genericAnnouncement
}

export function buildRequestDjText(title: string, artist: string) {
  return [
    'Hello, RJ FM listeners! We have a special song request from our audience.',
    `Coming up next is ${title} by ${artist}.`,
    'Thank you for sending your request and for listening to RJ FM, the number one radio station in the Bicol Region. From Naga City and Camarines Sur to Albay, Sorsogon, Catanduanes, Masbate, and the whole Philippines, this one is especially for you.',
    `Now, let me play ${title} by ${artist}, right here on RJ FM.`,
  ].join(' ')
}

export async function synthesizeEdgeTts(text: string) {
  const cleanText = text.trim().slice(0, 1800)
  if (!cleanText) throw new Error('Speech text is empty.')
  const synthesis = new UniversalEdgeTTS(cleanText, EDGE_TTS_VOICE).synthesize()
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Edge TTS synthesis timed out.')), 12_000)
  })
  const result = await Promise.race([synthesis, timeout])
  return Buffer.from(await result.audio.arrayBuffer())
}
