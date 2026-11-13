export interface QueueRequest {
  id: string
  requestedAt: number
  status: 'pending' | 'played' | 'skipped'
}

export function orderedPendingRequests<T extends QueueRequest>(requests: T[], limit = 12) {
  return requests
    .filter((request) => request.status === 'pending')
    .sort((a, b) => a.requestedAt - b.requestedAt)
    .slice(0, limit)
}

export function firstPlayableRequest<T extends QueueRequest>(requests: T[], canPlay: (request: T) => boolean) {
  return orderedPendingRequests(requests).find(canPlay) ?? null
}
