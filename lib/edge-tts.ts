import 'server-only'
import { EdgeTTS } from 'edge-tts-universal'

export const EDGE_TTS_VOICE = 'en-US-ChristopherNeural'
export const EDGE_TTS_DURATION_SECONDS = 56

const genericAnnouncement = [
  'Hello, hello, Bicol and the whole Philippines! This is Christopher on RJ FM, the number one radio station in the Bicol Region.',
  'From Naga City and Camarines Sur to Albay, Sorsogon, Catanduanes, Masbate, and every Filipino listener around the country, thank you for keeping us company. Stay safe, enjoy the music, and keep it right here on RJ FM.',
  'Here is a quick DJ joke: why did the radio bring an umbrella? Because it heard there was a chance of showers! Thank you for laughing with me. Now, let me play the next song for you, right here on RJ FM.',
].join(' ')

export function buildGenericDjText() {
  return genericAnnouncement
}

export function buildGuessChallengeText(title: string, artist: string) {
  return [
    'Hello, hello, RJ FM listeners! Christopher here with a quick song challenge.',
    'I am going to play a song, but do not look at the title. Listen carefully and guess the song and the artist before it finishes. Here is your clue: it is a beautiful favorite from our love-song rotation.',
    'Send your guess to the station, tell a friend, and have fun. Bicol, are you ready? Here we go. Now, let me play the song!',
  ].join(' ')
}

export function buildRevealText(title: string, artist: string) {
  return [
    'All right, listeners, time for the answer. Did you get it right?',
    `The correct title was ${title}, and the artist was ${artist}.`,
    'If nobody guessed it, now you know. Thank you for playing along with Christopher and RJ FM, the number one radio station in the Bicol Region. Let us keep the music moving.',
  ].join(' ')
}

export function buildRequestDjText(title: string, artist: string) {
  return [
    'Hello, RJ FM listeners! Christopher here with a special song request from our audience.',
    `Coming up next is ${title} by ${artist}.`,
    'Thank you for sending your request and for listening to RJ FM, the number one radio station in the Bicol Region. From Naga City and Camarines Sur to Albay, Sorsogon, Catanduanes, Masbate, and the whole Philippines, this one is especially for you.',
    `Now, let me play ${title} by ${artist}, right here on RJ FM.`,
  ].join(' ')
}

export async function synthesizeEdgeTts(text: string) {
  const cleanText = text.trim().slice(0, 1800)
  if (!cleanText) throw new Error('Speech text is empty.')
  const synthesis = new EdgeTTS(cleanText, EDGE_TTS_VOICE, {
    rate: '-4%',
    pitch: '-2Hz',
    volume: '+0%',
  }).synthesize()
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Edge TTS synthesis timed out.')), 12_000)
  })
  const result = await Promise.race([synthesis, timeout])
  return Buffer.from(await result.audio.arrayBuffer())
}
