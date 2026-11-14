export interface DailyPlayedSong {
  title: string
  artist: string
  playedAt: number
  key: string
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Identifies the underlying song rather than a particular recording or uploader title.
 * Artist credits and common version labels are removed so alternate singers/versions
 * share one daily no-repeat key.
 */
export function repeatTitleKey(title: string, artist = '') {
  let words = normalize(title.replace(/^song request\s*:\s*/i, '').replace(/\(.*?\)|\[.*?\]/g, ' ')).split(/\s+/).filter(Boolean)
  const artistWords = normalize(artist).split(/\s+/).filter(Boolean)
  if (artistWords.length > 0) {
    for (let index = 0; index <= words.length - artistWords.length;) {
      const matches = artistWords.every((word, offset) => words[index + offset] === word)
      if (matches) words.splice(index, artistWords.length)
      else index++
    }
  }

  let key = words.join(' ')
  // Remove common provider/version suffixes only at the end, not when they are part
  // of the actual title (e.g. "Live and Let Die"). Repeat to handle stacked labels.
  const suffixes = [
    /\s+(?:official\s+)?(?:music\s+)?video$/i,
    /\s+(?:official\s+)?(?:audio|lyrics?)$/i,
    /\s+(?:radio\s+)?edit$/i,
    /\s+(?:acoustic|live|karaoke|instrumental|remix|re-?mix|cover|version|remaster(?:ed)?|sped\s+up|slowed|nightcore)$/i,
    /\s+(?:acoustic|live|karaoke|instrumental|cover|remix|re-?mix|radio\s+edit|alternate|original)\s+version$/i,
    /\s+(?:covered|cover)\s+by\s+.+$/i,
    /\s+(?:covered|cover)\s+by$/i,
    /\s+(?:performed|sung|vocals?)\s+by\s+.+$/i,
    /\s+(?:feat(?:uring)?|ft)\s+.+$/i,
  ]
  let previous = ''
  while (key !== previous) {
    previous = key
    for (const suffix of suffixes) key = key.replace(suffix, '').trim()
  }
  // Provider titles often include different singer-credit orderings. Keep well-known
  // songs canonical so "Regine - Hanggang Ngayon" and "Hanggang Ngayon - Ogie"
  // cannot enter the same daily rotation twice.
  if (/\bhanggang\s+ngayon\b/i.test(key)) return 'hanggang ngayon'
  return key
}

export function rollDailyPlayedLog<T>(savedDate: string, currentDate: string, entries: T[]) {
  if (savedDate === currentDate) return { date: currentDate, entries, changed: false }
  return { date: currentDate, entries: [] as T[], changed: true }
}

export function appendCompletedSong(
  entries: DailyPlayedSong[],
  input: { title: string; artist: string; playedAt: number; key: string },
) {
  if (!input.key || entries.some((entry) => entry.key === input.key)) return entries
  return [...entries, input]
}

export function isCompletedDailyMusicTrack(input: {
  kind?: string
  title?: string
  endAt: number
  trackDay: string
  currentDay: string
  now: number
}) {
  return input.endAt <= input.now
    && (input.kind === 'music' || input.kind === 'mor-sync')
    && Boolean(input.title)
    && input.trackDay === input.currentDay
}

export function isInPlaybackQueue(endAt: number, now: number) {
  return endAt >= now - 1000
}
