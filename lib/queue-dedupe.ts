import { repeatTitleKey } from './song-repeat.ts'

export interface QueueDedupeTrack {
  kind?: string
  title?: string
  artist?: string
  youtubeId?: string
}

export function dedupeMusicQueue<T extends QueueDedupeTrack>(tracks: T[], artistFor: (track: T) => string = (track) => track.artist ?? '') {
  const titles = new Set<string>()
  const ids = new Set<string>()
  return tracks.filter((track) => {
    if (track.kind !== 'music' && track.kind !== 'mor-sync') return true
    const titleKey = repeatTitleKey(track.title ?? '', artistFor(track))
    const id = track.youtubeId?.trim()
    if ((titleKey && titles.has(titleKey)) || (id && ids.has(id))) return false
    if (titleKey) titles.add(titleKey)
    if (id) ids.add(id)
    return true
  })
}
