function normalize(value: string) {
  return value.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(?:official|music|video|lyrics?|audio|remastered|remaster|hd|hq|4k|mv)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Match a requested title and artist against YouTube metadata without requiring
 * the uploader/channel label to be classified as official. The exact title and
 * artist must still be present in the title or its channel/credit metadata.
 */
export function matchesRequestedSong(
  candidateTitle: string,
  candidateCredits: string,
  requestedTitle: string,
  requestedArtist: string,
) {
  const cleanCandidateTitle = candidateTitle
    .replace(/^[A-Z]{1,4}\d{1,3}\s+/, '')
    .replace(/\.(?:mp3|m4a|aac|wav)$/i, '')
    .replace(/\s+(?:mp3|m4a|aac|wav)$/i, '')
  const parts = cleanCandidateTitle.split(/\s+(?:[-–—|]|::)\s+/).map((part) => part.trim())
  const expectedTitle = normalize(requestedTitle)
  const expectedArtist = normalize(requestedArtist)
  if (!expectedTitle || !expectedArtist) return false

  const titleMatches = parts.some((part) => normalize(part) === expectedTitle)
    || normalize(cleanCandidateTitle) === expectedTitle
  const artistInTitle = parts.some((part) => normalize(part) === expectedArtist)
  const normalizedCredits = ` ${normalize(candidateCredits)} `
  const artistInCredits = normalizedCredits.includes(` ${expectedArtist} `)
  return titleMatches && (artistInTitle || artistInCredits)
}
